// jqm autoinit doesn't work for dynamic pages
$(document).bind("mobileinit", function() {
    $.mobile.autoInitializePage = false;

});

Chondric = {};

Chondric.App = function(options) {
    var app = this;
    this.ready = false;
    this.autohidesplashscreen = false;
    this.Pages = {};
    this.Actions = {};

    app.startTime = new Date().getTime();

    app.Views = {};
    app.ViewTemplates = {};


    app.createViewTemplate = function(baseView, viewName, templateFile, functions) {

        var template = function(options) {
            var settings = {
                template: templateFile
            };
            $.extend(settings, options)
            baseView.call(this, settings);
        }
        $.extend(template.prototype, baseView.prototype, functions);

        app.ViewTemplates[viewName] = template;

    };

    app.createViewTemplate(
    Chondric.View,
        "AppLoadTemplate",
        "index.html", {
        getDefaultModel: function() {
            return {};
        },
        updateModel: function(dataId, existingData, callback) {
            if (!this.model) this.model = this.getDefaultModel();
            var m = this.model;


            callback();
        },
        updateView: function() {

        },
        attachSubviews: function() {
            var page = this;


        }

    })

    app.Views.appLoadPage = new app.ViewTemplates.AppLoadTemplate({
        id: "appLoadPage"
    });

    app.activeView = app.Views.appLoadPage;


    app.platform = "web";
    app.isSimulator = false;

    function getByProp(arr, prop, val) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i][prop] == val) return arr[i];
        }
    }

    var settings = {
        name: "Base App",
        mightBePhoneGap: true,
        scriptGroups: [],
        contexts: {},
        enableScroll: true,
        getDatabase: null,
        loadData: function(loadedctx, callback) {
            callback()
        },
        customInit: function(callback) {
            callback()
        },
        debugMode: false
    };

    $.extend(settings, options);
    app.debugMode = settings.debugMode;

    function loadScripts(scriptGroupNum, callback) {
        console.log("starting loadscripts");
        if (scriptGroupNum >= settings.scriptGroups.length) {
            return callback();
        }
        console.log("calling require");
        require(settings.scriptGroups[scriptGroupNum], function() {
            loadScripts(scriptGroupNum + 1, callback)
        });
    }

    function initData(callback) {
        console.log("getting database");

        app.db = settings.getDatabase();
        if (!app.db) {
            callback();
        } else {
            app.db.updateDatabase(function() {

                callback();
            })
        }
    }


    app.context = {};
    app.contextValues = {};
    app.contextValueStrings = {};

    // set up context functions
    for (var cn0 in settings.contexts) {
        function newscope(cn1) {
            var cn = cn1;
            var ctx = settings.contexts[cn];
            app.context[cn] = function(val, ctxcallback) {
                // when called with no parameters, return the value
                if (val === undefined && !ctxcallback) return app.contextValues[cn];

                // if a string is provided, set the context
                if (typeof(val) == "string") {
                    if (!app.contextValueStrings[cn] || val != app.contextValueStrings[cn]) {
                        // value is changed
                        app.contextValueStrings[cn] = val;
                        if (ctx.getValueFromString) {
                            app.contextValues[cn] = ctx.getValueFromString(val);
                        } else {
                            app.contextValues[cn] = val;
                        }
                        if (ctx.childContexts) {
                            for (var i = 0; i < ctx.childContexts.length; i++) {
                                app.context[ctx.childContexts[i]]("");
                            }
                        }
                        // TODO: if not in initial load, save context to localstorage here.
                    }

                    localStorage["appcontext_" + settings.name] = JSON.stringify(app.contextValueStrings);
                }

                if (ctxcallback) ctxcallback(app.contextValues[cn])
            }
        }

        newscope(cn0);
    }

    function attachEvents(callback) {
        /*
        // disable default scrolling
        if(!settings.enableScroll) {
            $(function() {
                $("body")[0].ontouchmove = function(event) {
                    event.preventDefault();
                    return false;
                };
            });
        }
*/
        $('div[data-role="page"], div[data-role="dialog"]').live('pagecreate', PageCreated);

        $('div[data-role="dialog"]').live('pagebeforeshow', function(e, ui) {
            ui.prevPage.addClass("ui-dialog-background ");
            ui.prevPage.one("pageremove", function(e) {
                e.preventDefault();
            })
        });

        $('div[data-role="dialog"]').live('pagehide', function(e, ui) {
            $(".ui-dialog-background").removeClass("ui-dialog-background ");
        });



        $('a[href]').live('vclick', ButtonClick);

        $('div[data-role="page"], div[data-role="dialog"]').live('pagebeforeshow', PageBeforeShow);
        $('div[data-role="page"], div[data-role="dialog"]').live('pageshow', PageShown);

        $('a[data-iconpos="notext"]').live('taphold', function(event) {
            //alert("taphold");
            event.preventDefault();
            return false;
        });

        $('input, textarea').live('focus', function(event) {
            // disable horizontal scrolling when showing onscreen keyboard
            window.scrollTo(0, window.scrollY);
        });
        callback();
    }

    function complete(callback) {
        if (app.debugMode) {
            $("body").addClass("debugmode");
        }
        $("#startPage").attr("data-url", document.location.pathname.replace(/\/$/, "/index.html"));
        //        $.mobile.initializePage();
        app.autohidesplashscreen && navigator && navigator.splashscreen && navigator.splashscreen.hide();

        app.ready = true;
        callback();
    }

    function isScriptless(pagediv) {
        return $(pagediv).attr("data-scriptless") != undefined;
    }

    function PageCreated(event) {
        var pageid = this.id;
        var pagediv = this;



        console.log("created page " + pageid);
        //    $(pagediv).attr("style", "")
        if (isScriptless(pagediv)) {

            // TODO: allow this on scripted dialogs with data-autoclose attribute
            // scriptless dialogs can be closed by clicking outside
            // TODO: should this be vclick?
            if ($(pagediv).attr("data-role") == "dialog") {
                $(pagediv).click(function() {
                    $('.ui-dialog').dialog('close');
                });
                $("[data-role=content], [data-role=header]", pagediv).click(function(e) {
                    e.stopPropagation();
                });
            }

            return;

        }

        // TODO: this probably goes better elsewhere
        // converts a link with data-role help to a standard popup button
        $("[data-role='help']", pagediv).each(function() {
            // simple properties can be handled declaratively
            var element = $(this);
            element.html("Help");
            element.attr("data-role", "button");
            element.attr("data-icon", "info");
            element.attr("data-iconpos", "notext");
            element.attr("data-inline", "true");
            element.attr("data-transition", "pop");
            element.attr("data-rel", "dialog");

        });
        // ensure page script is loaded and call setup method of page
        if (app.Pages[pageid]) {
            app.Pages[pageid].attachEvents.call(app.Pages[pageid], pagediv);
            app.Pages[pageid].updateView.call(app.Pages[pageid], pagediv, null, true, true);
        } else {
            require(["pages/" + pageid.toLowerCase().replace(/page$/, "") + ".js"], function() {
                app.Pages[pageid].attachEvents.call(app.Pages[pageid], pagediv);
                app.Pages[pageid].updateView.call(app.Pages[pageid], pagediv, null, true, true);
            });
        }

    };

    function PageBeforeShow(event) {

        var pagediv = this;
        var pageid = this.id;

        console.log("shown page " + pageid);
        console.log("data-url = " + $(pagediv).attr("data-url"));


        //  $(pagediv).attr("style", "")
        if (isScriptless(pagediv)) return;

        if (app.Pages[pageid]) {
            app.Pages[pageid].updateView.call(app.Pages[pageid], pagediv, null, true, false);
        } else {
            require(["pages/" + pageid.toLowerCase().replace(/page$/, "") + ".js"], function() {
                app.Pages[pageid].updateView.call(app.Pages[pageid], pagediv, null, true, false);
            });
        }
    };

    function PageShown(event) {

        var pagediv = this;
        var pageid = this.id;

        console.log("shown page " + pageid);
        console.log("data-url = " + $(pagediv).attr("data-url"));


        //      $(pagediv).attr("style", "")
        if (isScriptless(pagediv)) return;

        if (app.Pages[pageid]) {
            app.Pages[pageid].updateView.call(app.Pages[pageid], pagediv, null, false, false);
        } else {
            require(["pages/" + pageid.toLowerCase().replace(/page$/, "") + ".js"], function() {
                app.Pages[pageid].updateView.call(app.Pages[pageid], pagediv, null, false, false);
            });
        }

    };


    function ButtonClick(event) {
        //alert("vclick");
        var link = $(this);

        if (link.attr("data-animate-click") && app.animateClick) {
            app.animateClick(link);

        }

        var action = app.Actions[link.attr("data-action")];
        if (link.attr("data-prepopulate")) {
            app.prepopulate = JSON.parse(link.attr("data-prepopulate"));
        }
        for (var cn in settings.contexts) {

            // TODO: need a way to handle custom context like file/version
            if (link.attr("data-context-" + cn)) {
                app.context[cn](link.attr("data-context-" + cn));
            }

        }

        if (action) {
            action.execute();
        } else {
            return true;
            //var href = link.attr("href");
            //if (href) $.mobile.changePage(href, {});
        }
        return false;
    };

    this.appLoadLog = function(msg) {
        console.log(msg);
    };

    this.getView = function(viewId) {
        var view = app.Views[viewId];
        if (view) return view;
        var ind = viewId.indexOf("_");
        var templateId = viewId.substr(0, ind) || viewId;
        view = app.Views[viewId] = new app.ViewTemplates[templateId]({
            id: viewId
        });

        return view;

    };

    this.transition = function(nextPageId, inPageClass, outPageClass) {
        if (app.transitioning) return;
        app.transitioning = true;
        var thisPage = app.activeView;
        thisPage.ensureLoaded("active", function() {
            var nextPage = app.getView(nextPageId);
            thisPage.deactivating(nextPage);
            nextPage.ensureLoaded(inPageClass, function() {
                nextPage.activating();
                thisPage.element.one("webkitTransitionEnd", function() {
                    app.transitioning = false;
                    nextPage.activated();
                    $(".page.next").removeClass("next");
                    $(".page.prev").removeClass("prev");
                    if (nextPage.next) app.getView(nextPage.next).ensureLoaded("next", function() {});
                    if (nextPage.prev) app.getView(nextPage.prev).ensureLoaded("prev", function() {});


                });

                thisPage.element[0].style.webkitTransform = null;
                nextPage.element[0].style.webkitTransform = null;

                thisPage.element.addClass(outPageClass).removeClass("active");
                nextPage.element.addClass("active").removeClass(inPageClass);


                app.activeView = nextPage;


            });



        });


    }

    var initEvents = function(callback) {

        app.touchevents = {
            touchstart: "touchstart",
            touchend: "touchend",
            touchmove: "touchmove"
        };


        if (document.ontouchend === undefined) {
            // touch not supported - use mouse events for swipe
            app.touchevents = {
                touchstart: "mousedown",
                touchend: "mouseup",
                touchmove: "mousemove"
            };
        }

        app.appLoadLog("Setting up event handlers");



        var nextPage = app.activeView;
        nextPage.ensureLoaded("active", function() {});
        if (nextPage.next) app.Views[nextPage.next].ensureLoaded("next", function() {});
        if (nextPage.prev) app.Views[nextPage.prev].ensureLoaded("prev", function() {});



        var swiping = false;

        var startX = 0;
        var startY = 0;
        var dx = 0;
        var dy = 0;

        var activePage;
        var nextPage;
        var prevPage;

        var viewportWidth;
        var horizontal = false;
        var vertical = false;

        var canSwipeLeft = false;
        var canSwipeRight = false;


        $(document).on(app.touchevents.touchstart, ".page.active.swipe", function(e) {
            //                alert("1");
            if (app.transitioning) return;
            if (swiping) return;
            swiping = true;


            if (e.originalEvent.changedTouches) {
                startX = e.originalEvent.changedTouches[0].clientX;
                startY = e.originalEvent.changedTouches[0].clientY;

            } else {
                startX = e.clientX;
                startY = e.clientY;
                dx = 0;
                dy = 0;
                horizontal = false;
                vertical = false;
            }
            activePage = $(".page.active");
            nextPage = $(".page.next");
            prevPage = $(".page.prev");

            viewportWidth = $(".viewport").width();

            canSwipeRight = prevPage.length > 0 || activePage.hasClass("swipetoblank")
            canSwipeLeft = nextPage.length > 0 || activePage.hasClass("swipetoblank")


        });


        $(document).on(app.touchevents.touchmove, ".page.active.swipe", function(e) {
            if (app.transitioning) return;
            if (!swiping) return;
            if (vertical) return;

            if (e.originalEvent.changedTouches) {
                dx = e.originalEvent.changedTouches[0].clientX - startX;
                dy = e.originalEvent.changedTouches[0].clientY - startY;
            } else {

                dx = e.clientX - startX;
                dy = e.clientY - startY;
            }
            if (dx > 20 || dx < -20 && (dy < 20 && dy > -20)) {
                horizontal = true;
            }

            if (!horizontal && (dy > 20 || dy < -20)) {
                vertical = true;
                dx = 0;
                activePage[0].style.webkitTransitionDuration = 0;
                activePage[0].style.webkitTransform = "translateX(" + (dx) + "px)";

            } else if (horizontal) {

                if (dx < 0 && canSwipeLeft) {
                    activePage[0].style.webkitTransitionDuration = 0;
                    activePage[0].style.webkitTransform = "translateX(" + (dx) + "px)";
                    if (nextPage[0]) {
                        nextPage[0].style.webkitTransitionDuration = 0;
                        nextPage[0].style.webkitTransform = "translateX(" + (viewportWidth + 10 + dx) + "px)";
                    }
                }
                if (dx > 0 && canSwipeRight) {
                    activePage[0].style.webkitTransitionDuration = 0;
                    activePage[0].style.webkitTransform = "translateX(" + (dx) + "px)";
                    if (prevPage[0]) {
                        prevPage[0].style.webkitTransitionDuration = 0;
                        prevPage[0].style.webkitTransform = "translateX(" + (-viewportWidth - 10 + dx) + "px)";
                    }
                }
                return false;

            }

            //   e.stopPropagation();
            //                return false;

        });
        $(document).on(app.touchevents.touchend, ".page.active.swipe", function(e) {
            if (app.transitioning) return;
            if (!swiping) return;
            swiping = false;

            activePage[0].style.webkitTransitionDuration = null;
            if (nextPage[0]) nextPage[0].style.webkitTransitionDuration = null;
            if (prevPage[0]) prevPage[0].style.webkitTransitionDuration = null;

            //  activePage[0].style.webkitTransform = null;
            //  nextPage[0].style.webkitTransform = null;
            //  prevPage[0].style.webkitTransform = null;

            $(".page.active .page.next .page.prev").attr("style", "");

            swiping = false;
            if (dx < -100 && app.activeView.next) app.activeView.showNextPage();
            else if (dx > 100 && app.activeView.prev) app.activeView.showPreviousPage();
            else {
                activePage[0].style.webkitTransform = null;
                if (nextPage[0]) nextPage[0].style.webkitTransform = null;
                if (prevPage[0]) prevPage[0].style.webkitTransform = null;
            }

            dx = 0;
            dy = 0;
            horizontal = false;
            vertical = false;



        });


        $(document).on("tap click", "a.pop", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");

            app.transition(id, "behindsmall", "behindfull");


            return false;

        })


        $(document).on("tap click", "a.close", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");

            app.transition(id, "behindfull", "behindsmall");


            return false;

        })

        $(document).on("tap click", "a.next", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            if (id == "next") id = app.activeView.next;

            app.transition(id, "next", "prev");


            return false;

        })


        $(document).on("tap click", "a.prev", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            if (id == "prev") id = app.activeView.prev;

            app.transition(id, "prev", "next");


            return false;

        })



        callback();
    };

    var loadFirstPage = function(callback) {
        // if first page is not specified in settings, custominit is responsible for loading it
        if (settings.firstPageTemplate) {
            var vid = settings.firstPageTemplate + "_" + settings.firstPageDataId;
            if (vid.indexOf("_") == vid.length - 1) vid = settings.firstPageTemplate;
            app.transition(vid, "behindsmall", "behindfull");
        }

        callback();

    };

    this.init = function(callback) {
        // load required scripts
        console.log("beginning app initialization");

        var initInternal = function() {
            console.log("begin internal init");
            //  alert("running init")
            loadScripts(0, function() {
                console.log("loaded scripts");
                initEvents(function() {


                    // create database
                    initData(function() {
                        console.log("loading context");

                        var loadedctx = JSON.parse(localStorage["appcontext_" + settings.name] || "{}");
                        //load data
                        settings.loadData.call(app, loadedctx, function() {
                            // attach common events
                            attachEvents(function() {
                                // custom init function
                                settings.customInit.call(app, function() {
                                    // hide splash screen and show page
                                    loadFirstPage(function() {

                                        complete(function() {
                                            if (callback) callback();
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        };

        if (window.WinJS) {
            app.platform = "windows"
            $(initInternal);
        } else if (settings.mightBePhoneGap && document.location.protocol == "file:") {
            // file protocol indicates phonegap
            app.isPhonegap = true;
            app.platform = "cordova";
            document.addEventListener("deviceready", function() {
                console.log("appframework deviceready");
                console.log(device.platform);
                app.isSimulator = device.platform.indexOf("Simulator") > 0;
                $(initInternal);
            }

            , false);
        } else {
            // no phonegap - web preview mode
            app.platform = "web"

            $(initInternal);
        }

    }
    return this;
};