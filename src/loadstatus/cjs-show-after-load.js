export default {
    name: "cjsShowAfterLoad",
    injections: ["$compile"],
    fn: ($compile) => ({
        link: function(scope, element, attrs) {

            scope.loadStatus.onUpdate(scope.$eval(attrs.cjsShowAfterLoad), function(taskGroup) {
                if (taskGroup.completed) {
                    element.addClass("ui-show").removeClass("ui-hide");
                } else {
                    element.addClass("ui-hide").removeClass("ui-show");
                }
            });
        }
    })
};

