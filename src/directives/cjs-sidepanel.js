Chondric.directive("cjsSidepanel", function() {

    return {
        //        restrict: "E",
        link: function(scope, element, attrs) {

            var useMouse = true;

            var iOS = (navigator.userAgent.match(/(iPad|iPhone|iPod)/g) ? true : false);

            if (iOS) {
                useMouse = false;
            }

            element.addClass("modal");
            element.addClass("sidepanel");
            if (!element.hasClass("left")) {
                element.addClass("right");
            }
            var overlay = $(".modal-overlay", element.parent());
            if (overlay.length == 0) {
                overlay = angular.element('<div class="modal-overlay"></div>');
                element.parent().append(overlay);
            }
            overlay.on(useMouse ? "mousedown" : "touchstart", function() {
                console.log("overlay touch");
                scope.$apply("hideModal('" + attrs.cjsSidepanel + "')");
            });
            scope.$watch(attrs.cjsSidepanel, function(val) {
                if (!val) {
                    element.removeClass("active");
                } else {
                    element.addClass("active");
                }
            })
        }
    }
});