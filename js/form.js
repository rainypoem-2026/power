// Showroom visit form: swap to the confirmation panel on submit, back on reset.
// TODO: send the form data to your booking backend before showing the confirmation.
(function () {
  var form = document.getElementById('visit-form');
  var done = document.getElementById('visit-done');
  var reset = document.getElementById('visit-reset');
  if (!form || !done || !reset) return;

  // The panel height changes, so scroll-driven positions must be recalculated.
  function refreshScroll() {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    form.hidden = true;
    done.hidden = false;
    done.querySelector('h3').focus({ preventScroll: true });
    refreshScroll();
  });

  reset.addEventListener('click', function () {
    form.reset();
    done.hidden = true;
    form.hidden = false;
    form.querySelector('input').focus({ preventScroll: true });
    refreshScroll();
  });
})();
