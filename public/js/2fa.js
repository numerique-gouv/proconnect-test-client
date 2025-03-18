document.addEventListener("DOMContentLoaded", function () {
	const tags = document.querySelectorAll(".tag-option");

	tags.forEach((tag) => {
		tag.addEventListener("click", function (e) {
			e.preventDefault();

			tags.forEach((t) => {
				t.classList.remove("tag-active");
			});

			this.classList.add("tag-active");

			const contents = document.querySelectorAll(".tag-content");
			contents.forEach((content) => {
				content.style.display = "none";
			});

			const targetId = this.getAttribute("data-target");
			const targetElement = document.getElementById(targetId);

			if (targetElement) {
				targetElement.style.display = "block";
			} else {
				console.error('Élément avec ID "' + targetId + '" non trouvé');
			}
		});
	});

	const radioButtons = document.querySelectorAll('input[name="radio-rich"]');
	const submitButton = document.getElementById("submitButton");

	radioButtons.forEach(function (radio) {
		radio.addEventListener("change", function () {
			submitButton.disabled = false;
		});
	});
});
const submitButton = document.getElementById("submitButton");
submitButton.addEventListener("click", function () {
	const selectedOption = document.querySelector(
		'input[name="radio-rich"]:checked'
	);

	if (selectedOption) {
		if (selectedOption.value === "totp") {
			window.location.href =
				"https://identite-sandbox.proconnect.gouv.fr/configuring-single-use-code";
		} else if (selectedOption.value === "passkey") {
			window.location.href =
				"https://identite-sandbox.proconnect.gouv.fr/double-authentication#webauthn-btn-begin-registration";
		}
	}
});
