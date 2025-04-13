document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("welcome-modal");
    const closeBtn = document.getElementById("close-welcome");

    if (!sessionStorage.getItem("welcomeModalShown")) {
        modal.style.display = "block";
        sessionStorage.setItem("welcomeModalShown", "true");
    }

    closeBtn.onclick = function () {
        modal.style.display = "none";
    };

    window.onclick = function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
});
