import "dotenv/config";
import express from "express";
import * as client from "openid-client";
import session from "express-session";
import morgan from "morgan";
import bodyParser from "body-parser";
import { chain, isObject } from "lodash-es";

const port = parseInt(process.env.PORT, 10) || 3000;
const app = express();

app.set("view engine", "ejs");
app.use(
  session({
    name: "pc_session",
    secret: process.env.SESSION_SECRET,
    rolling: true,
  }),
);
app.use(morgan("combined"));

const objToUrlParams = (obj) =>
  new URLSearchParams(
    chain(obj)
      .omitBy((v) => !v)
      .mapValues((o) => (isObject(o) ? JSON.stringify(o) : o))
      .value(),
  );

const getCurrentUrl = (req) =>
  new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);

const getProviderConfig = async () => {
  return await client.discovery(
    new URL(process.env.PC_PROVIDER),
    process.env.PC_CLIENT_ID,
    {
      client_secret: process.env.PC_CLIENT_SECRET,
      id_token_signed_response_alg: process.env.PC_ID_TOKEN_SIGNED_RESPONSE_ALG,
      userinfo_signed_response_alg:
        process.env.PC_USERINFO_SIGNED_RESPONSE_ALG || null,
    },
  );
};

const AUTHORIZATION_DEFAULT_PARAMS = {
  redirect_uri: `${process.env.HOST}${process.env.CALLBACK_URL}`,
  scope: process.env.PC_SCOPES,
  login_hint: process.env.LOGIN_HINT || null,
  acr_values: process.env.ACR_VALUES ? process.env.ACR_VALUES.split(",") : null,
  claims: {
    id_token: {
      amr: {
        essential: true,
      },
    },
  },
};

app.get("/", async (req, res, next) => {
  try {
    res.render("index", {
      title: process.env.SITE_TITLE,
      stylesheet_url: process.env.STYLESHEET_URL,
      userinfo: JSON.stringify(req.session.userinfo, null, 2),
      idtoken: JSON.stringify(req.session.idtoken, null, 2),
      oauth2token: JSON.stringify(req.session.oauth2token, null, 2),
      defaultParamsValue: JSON.stringify(AUTHORIZATION_DEFAULT_PARAMS, null, 2),
      showBetaFeatures: process.env.SHOW_BETA_FEATURES === "True",
    });
  } catch (e) {
    next(e);
  }
});

const getAuthorizationControllerFactory = (extraParams) => {
  return async (req, res, next) => {
    try {
      const config = await getProviderConfig();
      const nonce = client.randomNonce();
      const state = client.randomState();

      req.session.state = state;
      req.session.nonce = nonce;

      const redirectUrl = client.buildAuthorizationUrl(
        config,
        objToUrlParams({
          nonce,
          state,
          ...AUTHORIZATION_DEFAULT_PARAMS,
          ...extraParams,
        }),
      );

      res.redirect(redirectUrl);
    } catch (e) {
      next(e);
    }
  };
};

app.post("/login", getAuthorizationControllerFactory());

app.post(
  "/select-organization",
  getAuthorizationControllerFactory({
    prompt: "select_organization",
  }),
);

app.post(
  "/update-userinfo",
  getAuthorizationControllerFactory({
    prompt: "update_userinfo",
  }),
);

app.post(
  "/force-login",
  getAuthorizationControllerFactory({
    claims: {
      id_token: {
        amr: { essential: true },
        auth_time: { essential: true },
      },
    },
    prompt: "login",
    // alternatively, you can use the 'max_age: 0'
    // if so, claims parameter is not necessary as auth_time will be returned
  }),
);

app.post(
  "/force-2fa",
  getAuthorizationControllerFactory({
    claims: {
      id_token: {
        amr: { essential: true },
        acr: { essential: true, value: process.env.ACR_VALUE_FOR_2FA },
      },
    },
  }),
);

app.post(
  "/custom-connection",
  bodyParser.urlencoded({ extended: false }),
  (req, res, next) => {
    const customParams = JSON.parse(req.body["custom-params"]);

    return getAuthorizationControllerFactory(customParams)(req, res, next);
  },
);

app.get(process.env.CALLBACK_URL, async (req, res, next) => {
  try {
    const config = await getProviderConfig();
    console.log(JSON.stringify(config))
    const currentUrl = getCurrentUrl(req);
    console.log(currentUrl)
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      expectedNonce: req.session.nonce,
      expectedState: req.session.state,
    });

    req.session.nonce = null;
    req.session.state = null;
    const claims = tokens.claims();
    req.session.userinfo = await client.fetchUserInfo(
      config,
      tokens.access_token,
      claims.sub,
    );
    req.session.idtoken = claims;
    req.session.id_token_hint = tokens.id_token;
    req.session.oauth2token = tokens;
    res.redirect("/");
  } catch (e) {
    console.error(e)
    next(e);
  }
});

app.post("/logout", async (req, res, next) => {
  try {
    const id_token_hint = req.session.id_token_hint;
    req.session.destroy();
    const config = await getProviderConfig();
    const redirectUrl = client.buildEndSessionUrl(
      config,
      objToUrlParams({
        post_logout_redirect_uri: `${process.env.HOST}/`,
        id_token_hint,
      }),
    );

    res.redirect(redirectUrl);
  } catch (e) {
    next(e);
  }
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
