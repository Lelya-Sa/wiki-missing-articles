document.addEventListener("DOMContentLoaded", () => {
  const t = document.getElementById("tour-translations")?.dataset;


  const TOUR_TRANSLATIONS = {
    steps: {
      mainMsg: t.mainMsg,
      languageSelector: t.languageSelector,
      returnToMain: t.returnToMain,
      editLanguageList: t.editLanguageList,
      referLanguageList: t.referLanguageList,
      category: t.category,
      submit: t.submit,
      articles: t.articles
    },
    buttons: {
    next: t.next,
    back: t.back,
    done: t.done
  }
  };

  if (!TOUR_TRANSLATIONS) {
    console.error("Tour translations data not found.");
    return;
  }

  function setupTour() {
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shepherd-theme-arrows',
        scrollTo: true,
        scrollToHandler: (el) => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
        cancelIcon: { enabled: true }
      }
    });

    // ESC key to close the tour
    const handleEscKey = (e) => {
    if (e.key === 'Escape') {
      tour.cancel(); // Closes the tour
    }
    };


    const steps = [
        {
          id: 'first-step',
          text: TOUR_TRANSLATIONS.steps.mainMsg,
          attachTo: { element: '#body', on: 'bottom' }
        },
      {
          id: 'language-selector-step',
          text: TOUR_TRANSLATIONS.steps.languageSelector,
          attachTo: { element: '#top-right-container', on: 'bottom' }
        },
      {
          id: 'return-to-main-step',
          text: TOUR_TRANSLATIONS.steps.returnToMain,
          attachTo: { element: '#top-left-container', on: 'bottom' }

      },
      {
        id: 'edit-language-list-step',
        text: TOUR_TRANSLATIONS.steps.editLanguageList,
        attachTo: { element: '#article-language-selector', on: 'top' },
      },
      {
        id: 'refer-language-list-step',
        text: TOUR_TRANSLATIONS.steps.referLanguageList,
        attachTo: { element: '#article-refer-language-selector', on: 'top' },
      },
      {
        id: 'category-step',
        text: TOUR_TRANSLATIONS.steps.category,
        attachTo: { element: '#all-category-selector', on: 'right' },
      },
      {
        id: 'submit-step',
        text: TOUR_TRANSLATIONS.steps.submit,
        attachTo: { element: '#submit', on: 'bottom' },
      },
      {
        id: 'articles-step',
        text: TOUR_TRANSLATIONS.steps.articles,
        attachTo: { element: '#the-results', on: 'right' },
      },
      ];

    steps.forEach((step, index) => {
      tour.addStep({
        ...step,
        buttons: [
          ...(index > 0 ? [{ text: TOUR_TRANSLATIONS.buttons.back, action: tour.back }] : []),
          ...(index < steps.length - 1
            ? [{ text: TOUR_TRANSLATIONS.buttons.next, action: tour.next }]
            : [{ text: TOUR_TRANSLATIONS.buttons.done, action: tour.complete }])
        ],
        when: step.when || {
          show() {
            insertProgressBar(index, steps.length);
          }
        }
      });
    });

    return tour;
  }

  function insertProgressBar(stepIndex, totalSteps) {
    const stepEl = document.querySelector('.shepherd-step');
    if (stepEl) {
      const oldBar = stepEl.querySelector('.shepherd-progress-bar');
      if (oldBar) oldBar.remove();

      const progressBar = document.createElement('div');
      progressBar.className = 'shepherd-progress-bar';
      progressBar.style.width = `${((stepIndex + 1) / totalSteps) * 100}%`;

      const footer = stepEl.querySelector('.shepherd-footer');
      if (footer) footer.insertBefore(progressBar, footer.firstChild);
    }
  }

  // Manual start button
  document.getElementById('start-tour').addEventListener('click', () => {
    setupTour().start();
  });

  // Show only once per session
  if (!sessionStorage.getItem("navigationTour")) {
    setupTour().start();
    sessionStorage.setItem("navigationTour", "true");
  }
});
