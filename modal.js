(function () {

    var modals;

    var modalFunctions = {
        close: function () {
            this.style.display = 'none';
        },
        show: function () {
            this.style.display = 'block';
        }
    };

    function initModal(modal) {
        var close = document.createElement('div');
        close.classList.add('close');
        close.innerHTML = 'x';
        modal.insertBefore(close, modal.firstChild);

        Object.bind(modal, modalFunctions);

        close.addEventListener('click', modal.close);
    }

    function init () {
        modals = document.querySelectorAll('[modal]');
        modals.forEach(initModal);
    }

    document.addEventListener('DOMContentLoaded', init);
})();