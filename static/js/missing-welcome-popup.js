document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("missing-welcome-modal");
    const closeBtn = document.getElementById("missing-close-welcome");

    // Show only once per session
    if (!sessionStorage.getItem("missingWelcomeModalShown")) {
        modal.style.display = "block";
        sessionStorage.setItem("missingWelcomeModalShown", "true");
    }

    // Close when clicking the × button
    closeBtn.addEventListener("click", function () {
        modal.style.display = "none";
    });

    // Close when clicking outside the modal content
    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

    // Close when pressing the Escape key
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && modal.style.display === "block") {
            modal.style.display = "none";
        }
    });
});
