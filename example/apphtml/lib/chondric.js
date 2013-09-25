// ie doesn't like console.log

if (!window.console) {
    window.console = {
        log: function() {},
        error: alert
    };
}

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


    app.createViewTemplate = function(baseView, templateId, templateFile, options) {

        if (typeof templateId == "string") {
            // old format
            options.baseView = baseView;
            options.templateId = templateId;
            options.templateFile = templateFile;
        } else {
            options = baseView;
        }

        var templateSettings = {
            templateId: options.templateId,
            templateFile: options.templateFile || (options.templateId + ".html"),
            baseView: options.baseView || Chondric.View,
        };

        if (options.initAngular || options.angularModules) {
            options.useAngular = true;
        }

        var template = function(viewoptions) {
            var settings = {};
            $.extend(settings, templateSettings, viewoptions);
            templateSettings.baseView.call(this, settings);
            this.settings = settings;
        };

        var functions = {};

        for (var k in options) {
            var v = options[k];
            if (k == "baseView") continue;
            else if (k == "templateId") continue;
            else if (k == "templateFile") continue;
            else if (typeof v == "function") functions[k] = v;
            else templateSettings[k] = v;
        }

        $.extend(template.prototype, templateSettings.baseView.prototype, functions);

        app.ViewTemplates[options.templateId] = template;

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
        getDatabase: null,
        loadData: function(loadedctx, callback) {
            callback();
        },
        customInit: function(callback) {
            callback();
        },
        updateNotificationSettings: function(deviceId, notificationsEnabled) {
            // send details to the notification server
            console.warn("updateNotificationSettings is not implemented");
        },
        notificationReceived: function(event) {
            console.warn("notificationReceived is not implemented");
        },
        debugMode: false
    };


    $.extend(settings, options);
    app.debugMode = settings.debugMode;
    app.angularModules = settings.angularModules;
    app.notificationReceived = settings.notificationReceived;

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


    var pageCleanupTimer = 0;
    this.pageCleanup = function() {
        var currentPage = app.activeView;
        var lastPage = app.lastPage;
        var preloads = app.activeView.preloads || [];
        if (currentPage.next) preloads.push(currentPage.next);
        if (currentPage.prev) preloads.push(currentPage.prev);

        // remove any pages not in preload list

        for (var k in app.Views) {
            if (currentPage && currentPage.id == k) continue;
            if (currentPage && currentPage.prev == k) continue;
            if (currentPage && currentPage.next == k) continue;
            if (lastPage && lastPage.id == k) continue;
            if (preloads.indexOf(k) >= 0) continue;
            var v = app.Views[k];
            if (v.element) v.element.remove();
            delete v.element;
            delete app.Views[k];
        }

        // todo: load any pages in preload list that are not already loaded

        for (var i = 0; i < preloads.length; i++) {
            console.log("preload: " + preloads[i]);
            app.getView(preloads[i]).ensureLoaded(null, function() {});
        }

        pageCleanupTimer = 0;
    }

    this.queuePageCleanup = function() {
        if (!pageCleanupTimer) {
            pageCleanupTimer = window.setTimeout(app.pageCleanup, 200);
        }
    }

    this.transition = function(nextPageId, inPageClass, outPageClass) {
        /*
        if (!app.transitionClasses) {
            app.transitionClasses= {};
            for (var tn in transitions) {
                app.transitionClasses[app.transitions[tn].inPageClass] = true;
                app.transitionClasses[app.transitions[tn].outPageClass] = true;
            }
        }*/

        if (app.transitioning) {
            if (app.transitioningTo != nextPageId) {
                // transition changed
                // immediately complete existing transition, but do not call activated event
                app.transitioning = false;
                app.transitioningTo = undefined;

            } else {
                // transition called twice - ignore
                return;
            }
        }

        app.transitioning = true;
        app.transitioningTo = nextPageId;
        var thisPage = app.lastPage = app.activeView;
        thisPage.ensureLoaded("active", function() {
            var nextPage = app.getView(nextPageId);
            thisPage.deactivating(nextPage);

            //            $("."+inPageClass).removeClass(inPageClass);
            nextPage.ensureLoaded(inPageClass, function() {
                window.setTimeout(function() {
                    history.pushState({}, null, "#" + nextPageId);
                    nextPage.activating(thisPage);
                }, 0);

                thisPage.element.one("webkitTransitionEnd", function() {
                    window.setTimeout(function() {
                        app.transitioning = false;
                        app.transitioningTo = undefined;
                        if (!app.splashScreenHidden) app.hideSplashScreen();
                        nextPage.activated();
                        app.queuePageCleanup();
                    }, 0);
                });


                thisPage.setSwipePosition(null, nextPage.element, null);

                //              $("."+outPageClass).removeClass(outPageClass);
                thisPage.element.addClass(outPageClass).removeClass("active");
                nextPage.element.addClass("active").removeClass(inPageClass);


                app.activeView = nextPage;


            });



        });


    };


    this.transitions = {
        pop: {
            inPageClass: "behindsmall",
            outPageClass: "behindfull"
        },
        dlgpop: {
            inPageClass: "behindsmall",
            outPageClass: "behinddlg"
        },
        dlgclose: {
            inPageClass: "behinddlg",
            outPageClass: "behindsmall"
        },
        close: {
            inPageClass: "behindfull",
            outPageClass: "behindsmall"
        },
        prev: {
            inPageClass: "prev",
            outPageClass: "next"
        },
        next: {
            inPageClass: "next",
            outPageClass: "prev"
        },
        crossfade: {
            inPageClass: "behindfull",
            outPageClass: "behindfull"
        }
    };

    this.changePage = function(pageId, transitionId) {
        var transition = app.transitions[transitionId] || app.transitions.crossfade;
        if (pageId == "prev") pageId = app.activeView.prev;
        if (pageId == "next") pageId = app.activeView.next;
        if (!pageId) return;
        app.transition(pageId, transition.inPageClass, transition.outPageClass);
    };


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
                touchend: "mouseup mouseleave",
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

            //            console.log("start swipe");

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

            activePage = app.activeView.element;
            nextPage = app.activeView.next && app.getView(app.activeView.next).element;
            prevPage = app.activeView.prev && app.getView(app.activeView.prev).element;

            app.viewportWidth = $(".viewport").width();

            canSwipeRight = prevPage && prevPage.length > 0 || activePage.hasClass("swipetoblank");
            canSwipeLeft = nextPage && nextPage.length > 0 || activePage.hasClass("swipetoblank");


        });


        $(document).on(app.touchevents.touchmove, ".page.active.swipe", function(e) {
            if (app.transitioning) return;
            if (!swiping) return;
            if (vertical) return;
            //            console.log("continue swipe");

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
                app.activeView.setSwipePosition(prevPage, nextPage, dx, 0);

            } else if (horizontal) {

                if (dx < 0 && canSwipeLeft) {
                    app.activeView.setSwipePosition(prevPage, nextPage, dx, 0);
                }
                if (dx > 0 && canSwipeRight) {
                    app.activeView.setSwipePosition(prevPage, nextPage, dx, 0);

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
            //   console.log("end swipe");

            app.activeView.setSwipePosition(prevPage, nextPage, undefined, null);

            $(".page.active .page.next .page.prev").attr("style", "");

            swiping = false;
            if (dx < -100 && app.activeView.next) app.activeView.showNextPage();
            else if (dx > 100 && app.activeView.prev) app.activeView.showPreviousPage();
            else {

                app.activeView.setSwipePosition(prevPage, nextPage, null, null);

            }

            dx = 0;
            dy = 0;
            horizontal = false;
            vertical = false;



        });



        $(document).on("tap click", "a.pop", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            console.warn("obsolete - use ng-tap=\"app.changePage('" + id + "', 'pop')");

            app.changePage(id, "pop");
            return false;
        });
        $(document).on("tap click", "a.dlgpop", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            console.warn("obsolete - use ng-tap=\"app.changePage('" + id + "', 'dlgpop')");
            app.changePage(id, "dlgpop");
            return false;
        });
        $(document).on("tap click", "a.dlgclose", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            console.warn("obsolete - use ng-tap=\"app.changePage('" + id + "', 'dlgclose')");
            app.changePage(id, "dlgclose");
            return false;
        });


        $(document).on("tap click", "a.close", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            console.warn("obsolete - use ng-tap=\"app.changePage('" + id + "', 'close')");
            app.changePage(id, "close");
            return false;

        });

        $(document).on("tap click", "a.next", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            if (id == "next") id = app.activeView.next;
            console.warn("obsolete - use ng-tap=\"app.changePage('" + id + "', 'next')");
            app.changePage(id, "next");
            return false;

        });


        $(document).on("tap click", "a.prev", function() {
            var link = $(this);
            var id = link.attr("href").replace("#", "");
            if (id == "prev") id = app.activeView.prev;
            console.warn("obsolete - use ng-tap=\"app.changePage('" + id + "', 'prev')");
            app.changePage(id, "prev");
            return false;

        });



        callback();
    };

    var loadFirstPage = function(callback) {
        // if first page is not specified in settings or hash, custominit is responsible for loading it

        if (location.hash.length > 1) {
            app.changePage(location.hash.substr(1));
        } else {
            if (settings.firstPageTemplate) {
                var vid = settings.firstPageTemplate + "_" + settings.firstPageDataId;
                if (vid.indexOf("_") == vid.length - 1) vid = settings.firstPageTemplate;
                app.changePage(vid, "crossfade");
            }
        }

        callback();

    };

    app.splashScreenHidden = false;
    app.hideSplashScreen = function() {
        if (!app.splashScreenHidden) return;
        if (app.platform == "cordova" && navigator && navigator.splashscreen) {
            navigator.splashscreen.hide();
        }
        app.splashScreenHidden = true;
    };

    app.registerForNotifications = function() {
        if (app.platform == "cordova" && window.plugins && window.plugins.pushNotification) {
            window.plugins.pushNotification.register(function(result) {
                settings.updateNotificationSettings(result, true);
            }, function(error) {
                console.error(error);
                settings.updateNotificationSettings(null, false);
                // alert(error);
            }, {
                badge: "true",
                sound: "true",
                alert: "true",
                ecb: "app.notificationReceived"
            });

        }
    };

    var loadHostSettings = function(callback) {

        $.ajax({
            url: "../settings.json" + location.search,
            dataType: "json",
            error: function(data) {
                console.warn("error loading ../settings.json");
                app.hostSettings = {};
                callback();
            },
            success: function(data) {
                app.hostSettings = data;
                if (data.debug !== undefined) app.debugMode = data.debug;
                callback();
            }
        });

        callback;
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
                    loadHostSettings(function() {

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
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };

        if (window.WinJS) {
            app.platform = "windows";
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

    };
    return this;
};

;;

Chondric.View = function(options) {
    var settings = {
        id: null,
        element: null,
        swipe: true,
        swipeToBlank: false
    };

    $.extend(settings, options);

    this.settings = settings;

    for (var k in settings) {
        this[k] = settings[k];
    }
    //$.extend(this, settings);
    this.initInternal(settings);
}
$.extend(Chondric.View.prototype, {
    // obsolete - should use updateView instead
    updateViewBackground: function() {
        this.updateView();
    },
    updateView: function() {

    },
    attachEvents: function() {
        console.log("no events to attach");
    },
    renderThumbnail: function(el) {},
    getDefaultModel: function() {
        return {};
    },
    updateModel: function(dataId, existingData, callback) {
        if (!this.model) this.model = this.getDefaultModel();
        var m = this.model;


        callback();
    },

    // called to update the view with new data - eg download status
    // may do nothing if the view is not loaded.
    // if the view is loaded but not visible, the model is updated so that the change 
    // can be applied when the view is shown.
    updateData: function(d) {

    },
    init: function(options) {
        //  console.log("init view - " + options.testOption);
        // default implementation
    },
    initAngular: function() {},
    initInternal: function(options) {
        console.log("init view - " + options.testOption);
        this.init(options);
    },
    templateLoaded: function() {
        console.log("template loaded");
    },
    activating: function() {
        console.log("activating");
    },
    activated: function() {
        console.log("activated");
    },
    deactivating: function(nextPage) {
        console.log("deactivating");
    },

    setSwipePosition: function(prevPageElement, nextPageElement, dx, duration) {
        //        console.log("default: "+dx);
        var thisPage = this;
        if (duration !== undefined) {
            thisPage.element[0].style.webkitTransitionDuration = duration;
            if (nextPageElement && nextPageElement[0]) nextPageElement[0].style.webkitTransitionDuration = duration;
            if (prevPageElement && prevPageElement[0]) prevPageElement[0].style.webkitTransitionDuration = duration;

        }

        if (dx === null) {
            thisPage.element[0].style.webkitTransform = null;
            if (nextPageElement && nextPageElement[0]) nextPageElement[0].style.webkitTransform = null;
            if (prevPageElement && prevPageElement[0]) prevPageElement[0].style.webkitTransform = null;

        } else if (dx !== undefined) {
            if (prevPageElement) prevPageElement.addClass("prev");
            if (nextPageElement) nextPageElement.addClass("next");

            thisPage.element[0].style.webkitTransform = "translateX(" + (dx) + "px)";
            if (nextPageElement && nextPageElement[0] && dx < 0) {

                nextPageElement[0].style.webkitTransform = "translateX(" + (app.viewportWidth + 10 + dx) + "px)";

            }
            if (prevPageElement && prevPageElement[0] && dx > 0) {

                prevPageElement[0].style.webkitTransform = "translateX(" + (-app.viewportWidth - 10 + dx) + "px)";

            }

        }
    },

    load: function() {
        var view = this;

        // todo: load via ajax
        var viewurl = view.templateFile + "?nocache=" + app.startTime;

        $.get(viewurl, null, function(data) {
            var html = $(data);
            var pe = $(".page", html);

            var content = "";

            if (html.length === 0) {
                content = "Error - Invalid page template";
            } else if (html.hasClass("page")) {
                content = html.html();
            } else if (pe.length >= 1) {
                content = pe.html();
            } else {
                content = data;
            }

            view.element.html(content);
            if (view.useAngular) {
                var ctrl = pe.attr("ng-controller") || html.attr("ng-controller");
                if (ctrl) view.element.attr("ng-controller", ctrl);

                console.log("Init angular");

                view.angularModule = angular.module("page_" + view.id, []);

                view.initAngular();

                for (var k in view.controllers) {
                    view.angularModule.controller(k, view.controllers[k]);
                }
                angular.bootstrap(view.element[0], ["page_" + view.id, "chondric"].concat(app.angularModules || [], view.angularModules || []));



            }


            view.updateViewBackground();
            view.attachEvents();
            view.loading = false;
            view.element.removeClass("loading");
        });



    },
    ensureDataLoaded: function(callback) {
        var view = this;
        if (!view.model) {
            var ind = view.id.indexOf("_");
            var templateId = view.id.substr(0, ind) || view.id;
            var dataId = view.id.substr(templateId.length + 1);

            view.updateModel(dataId, null, callback);

        } else {
            callback();
        }
    },

    ensureLoaded: function(pageclass, callback) {
        var view = this;

        if (view.element && (!pageclass || view.element.attr("class") == "page " + templateId + " " + pageclass)) {
            // page already exists and is positioned correctly - eg during next/prev swipe
            return callback();
        }


        var ind = view.id.indexOf("_");
        var templateId = view.id.substr(0, ind) || view.id;

        var safeId = view.id.replace(/\/\.\|/g, "_");

        view.ensureDataLoaded(function() {

            view.element = $("#" + safeId);

            if (view.element.length == 0) {
                view.loading = true;
                // page not loaded - create it
                $(".viewport").append("<div class=\"page " + templateId + " notransition loading " + pageclass + "\" id=\"" + safeId + "\"></div>");
                view.element = $("#" + safeId);
                view.element.append("<div class=\"content\"></div>");
                view.element.append("<div class=\"loadingOverlay\"><a href=\"javascript:window.location.reload()\">Reload</a></div>");

                view.load();
            }

            if (pageclass) {
                // remove pageclass from any other pages
                $(".page." + pageclass).each(function() {
                    if (this != view.element[0]) $(this).removeClass(pageclass);
                });
                view.element.attr("class", "page " + templateId + " notransition " + pageclass);
            }
            if (view.swipe) view.element.addClass("swipe");
            if (view.swipeToBlank) view.element.addClass("swipetoblank");
            if (view.loading) view.element.addClass("loading");


            window.setTimeout(function() {
                view.element.removeClass("notransition");
                window.setTimeout(function() {
                    callback();
                }, 0);
            }, 0);

        });

    },

    showNextPage: function() {
        if (!this.next) return;
        app.changePage(this.next, "next");
    },
    showPreviousPage: function() {
        if (!this.prev) return;
        app.changePage(this.prev, "prev");
    }

});


Chondric.SampleSubviewTemplate = function(options) {
    var settings = {
        template: "subview.html"
    };
    $.extend(settings, options)
    Chondric.View.call(this, settings);
}
$.extend(Chondric.SampleSubviewTemplate.prototype, Chondric.View.prototype, {
    getDefaultModel: function() {
        return {};
    },
    updateModel: function(dataId, callback) {
        if (!this.model) this.model = this.getDefaultModel();
        var m = this.model;

        callback();
    },
    updateView: function() {
        // update elements directly
    }
});



Chondric.SampleViewTemplate = function(options) {
    var settings = {
        template: "index.html"
    };
    $.extend(settings, options)
    Chondric.View.call(this, settings);
}
$.extend(Chondric.SampleViewTemplate.prototype, Chondric.View.prototype, {
    getDefaultModel: function() {
        return {};
    },
    updateModel: function(dataId, callback) {
        if (!this.model) this.model = this.getDefaultModel();
        var m = this.model;

        this.subViews["firstSubView"].setModel(m.subviewmodel);
        callback();
    },
    updateView: function() {
        this.subViews["firstSubView"].updateView();
    },
    attachSubviews: function() {
        var page = this;
        this.subViews["firstSubView"] = new Chondric.SampleSubviewTemplate({
            id: page.id + "_subview1",
            element: $(".subview", page.element)
        });

    }
});

            (function($) {

                $.fn.listSync = function(rawdata, options) {
                    // populate a list using the template
                    var container = this;

                    var settings = container.data("listSyncSettings");

                    if (!settings) {
                        // first call of listSync
                        settings = {
                            // selector for items. applies to both the view and the template
                            itemClass: "result",

                            // property of the data object that can be used as a unique identifier
                            dataId: "dataId",
                            selectionMode: "none",
                            sortList:true,


                            // function for populating a subview
                            itemMapper: function(subView, itemData) {

                            }
                        }
                        $.extend(settings, options);

                        // get the template
                        settings.templateElement = $(">." + settings.itemClass + "[data-role='viewTemplate']", container);

                        // parse the template so that we know which properties are needed for change detection
                        settings.populatedProperties = {};

                        settings.populatedProperties[settings.dataId] = true;

                        $("[data-role='autopopulate']", settings.templateElement).each(function() {
                            // simple properties can be handled declaratively
                            // skip items that are not immediate children of the subview - i.e. the closest view template ancestor is the current template
                            var viewTemplateAncestor = $(this).closest("[data-role=viewTemplate]");
                            if (viewTemplateAncestor[0] != settings.templateElement[0]) {
                                settings.hasSubviews = true;
                                return;
                            }
                            var propName = $(this).attr("data-property");
                            settings.populatedProperties[propName] = true;
                        });


                        if (settings.selectionMode == "single") {
                            // TODO: these selectors don't support subviews
                            // ">[data-role=view]" is apparently not valid with on.
                            container.on("vclick", "."+settings.itemClass, function() {
                                var btn = $(this);
                                $(">.active", container).removeClass("active");
                                btn.addClass("active");
                                container.trigger("change");
                            });

                        } else if (settings.selectionMode == "multiple") {
                            container.on("vclick", "."+settings.itemClass, function() {
                                $(this).toggleClass("active");
                                container.trigger("change");
                            });
                        }

                        // list items which have already been displayed so can be reused
                        settings.renderedElements = {};


                        // initialize with any preexisting list items
    var children = container.children();
    for (var i = 0; i < children.length; i++) {
        var el = $(children[i]);
        if (el.attr("data-role") == "view") {
            settings.renderedElements[el.attr("data-id")] = el;
        }
            }


                        container.data("listSyncSettings", settings);
                    }

                    if (options) {
                        // options are optional for subsequent calls
                        $.extend(settings, options);
                        container.data("listSyncSettings", settings);
                    }

                    // normalize the input data. we always want an array for ordering and a map with 
                    // key matching data id for easy updating of individual items.
                    var orderedKeys = [];
                    var data = {};

                    if (rawdata instanceof Array) {
                        for (var i = 0; i < rawdata.length; i++) {
                            var o = rawdata[i];
                            var k = o[settings.dataId];
                            orderedKeys.push(k);
                            data[k] = o;
                        }
                    } else {
                        for (n in rawdata) {
                            var o = rawdata[n];
                            var k = o[settings.dataId];
                            orderedKeys.push(k);
                            data[k] = o;
                        }
                    }

                    if (orderedKeys.length == 0) {
                        container.addClass("emptylist");
                        for (var k in settings.renderedElements) {
                            settings.renderedElements[k].remove();
                           }
                           settings.renderedElements = {};
                           return;
                    } else {
                        container.removeClass("emptylist");
                    }


                    // list elements for the current iteration - includes previously rendered and new elements
                    // will be copied as settings.renderedElements later.
                    var listItemElements = {};



/************************************/
/* Local functions */
/************************************/

                    var itemHasChanged = function(previousData, newData) {
                            if (!previousData) return true;
                            if (settings.itemHasChanged) {
                                return settings.itemHasChanged(previousData, newData)
                            } else {
                                for (var pn in settings.populatedProperties) {
                                    if (previousData[pn] != newData[pn]) return true;
                                }
                                return false;
                            }
                        }

                    var getMonitoredValues = function(itemdata) {
                            var result = {};
                            for (var pn in settings.populatedProperties) {
                                result[pn] = itemdata[pn];
                            }
                            return result;
                        }

                    var getSubView = function(itemdata) {
                            var dataId = itemdata[settings.dataId];
                            var subView = listItemElements[dataId];


                            if (!subView) {
                                // the subview does not yet exist - create it
                                subView = settings.templateElement.clone();
                                subView.attr("data-role", "view");
                                subView.attr("data-id", dataId);

                                subView.appendTo(container);
                                listItemElements[dataId] = subView;
                            }

                            var previousData = subView.data("populatedValues");

                            var newValues = getMonitoredValues(itemdata);

                            if (!itemHasChanged(previousData, newValues)) return;

                            subView.data("populatedValues", newValues);
                            subView.data("originalItem", itemdata);

                            // data has changed - populate the subview
                            $("[data-role='autopopulate']", subView).each(function() {
                                // simple properties can be handled declaratively
                                var element = $(this);

                                if (settings.hasSubviews) {
                                    // skip items that are not immediate children of the subview - i.e. they have
                                    // no viewTemplate ancestor and the closest view ancestor is this subview
                                    var viewTemplateAncestor = $(this).closest("[data-role=viewTemplate]");
                                    var viewAncestor = $(this).closest("[data-role=view]");
                                    if (viewTemplateAncestor.length > 0) return;
                                    if (viewAncestor[0] != subView[0]) return;
                                }

                                var propName = $(this).attr("data-property");
                                var val = itemdata[propName];
                                element.html(val);
                            });


                            if (settings.itemMapper) {
                                settings.itemMapper(subView, itemdata)
                            }

                            return subView;
                        }
/************************************/
/* End local functions */
/************************************/




                    // iterate over previously rendered items, see if any need removing

                    for (var k in settings.renderedElements) {
                        var el = settings.renderedElements[k];
                        if (!data[k]) {
                            // data no longer contains this item - remove it
                            el.remove();
                           } else {
                            listItemElements[k] = el;
                           }
                        }

                    // iterate over data, adding and updating elements as necessary

                    for (var i = 0; i < orderedKeys.length; i++) {
                        var el = getSubView(data[orderedKeys[i]]);
                    }

                    settings.renderedElements = listItemElements;

                    if (settings.sortList) {
                        var domElements = $(">[data-role=view]", container);
                        var domIndex = 0;
                        var keyIndex = 0;

                        var sortedKeys = {};
                        while (keyIndex < orderedKeys.length && domIndex < domElements.length) {                             
                             var expected = orderedKeys[keyIndex];
                             var actual = $(domElements[domIndex]).attr("data-id");
                             if (expected == actual) {
                                domIndex++;
                                keyIndex++;
                                sortedKeys[actual] = true;
                                continue;
                             }
                             if (sortedKeys[expected]) {
                                keyIndex++;
                                continue;
                             }
                             if (sortedKeys[actual]) {
                                domIndex++;                            
                                continue;
                             }

                             listItemElements[expected].insertBefore(domElements[domIndex]);
                             domElements = $(">[data-role=view]", container);
                        }
                    }


                    return this;
                };
            })(jQuery);

;;

Chondric.VersionedDatabase = function(db, updatefunctions, tables) {

    this.sqlerror = function(t, err) {
        if (err && err.message) console.error(err.message);
        else if (t && t.message) console.error(t.message);
        else if (err) {
            console.error(err);
        } else if (t) {
            console.error(t);
        } else {
            console.log("sql error");
        }
    };
    var sqlerror = this.sqlerror;

        var getVersion = function(versionCallback) {
            console.log("checking version")

            db.transaction(function(tx) {
                tx.executeSql("SELECT * FROM settings where key=?", ["dbVersion"], function(t, result) {
                    if (result.rows.length == 0) return versionCallback(0);
                    var row = result.rows[0] || result.rows.item(0)
                    window.setTimeout(function() {return versionCallback(parseFloat(row["val"]));}, 0);
                }, function() {
                    // error - no db
                    window.setTimeout(function() {versionCallback(0);}, 0);
                });
            }, function() {
                    // error - no db
                    window.setTimeout(function() {versionCallback(0);}, 0);
                });
        }

    this.updateDatabase = function(callback) {



        getVersion(function(currentVersion) {
            console.log("Current database version is " + currentVersion)

            var existingversion = currentVersion;

              var versionQueue = [];

            for(vn in updatefunctions) {
                var vv = parseFloat(vn);
                if(existingversion < vv) {
                    versionQueue.push(vn);
                }
            }
 
            if (versionQueue.length == 0) return callback();

            db.transaction(function(tx) {
                for (vn in updatefunctions) {
                    var vv = parseFloat(vn);
                    if (existingversion < vv) {
                        updatefunctions[vn](tx);
                        tx.executeSql('INSERT OR REPLACE INTO settings (key, val) VALUES (?, ?)', ["dbVersion", vv], function() {}, sqlerror);
                        existingversion = vv;
                    }
                }
            }, sqlerror, function() {
                callback();
            });
        });
    }


    this.dropDatabase = function(callback) {
        db.transaction(function(tx) {
            for (tn in tables) {
                tx.executeSql("DROP TABLE " + tn, [], null, sqlerror);
            }
        }, sqlerror, function() {
            callback();
        });
    }

    this.resetDatabase = function(callback) {
        var that = this;
        this.dropDatabase(function() {
            that.updateDatabase(callback);
        });
    }

}


angular.module('chondric', [])
  .directive('ngTap', function() {

  return function(scope, element, attrs) {
    element.addClass('tappable');
    // eanble use of app global in angular expression if necessary
    if (attrs.ngTap && attrs.ngTap.indexOf("app.") == 0 && !scope.app) scope.app = app;
    var tapping = false;
    var touching = false;
    var clicking = false;


    var touchstart = function(e) {
      element.addClass('active');
      element.removeClass('deactivated');
      tapping = true;
    };

    var touchmove = function(e) {
      element.removeClass('active');
      element.addClass('deactivated');
      if (tapping) {
        tapping = false;
      }
      };

var touchend = function(e) {


      element.removeClass('active');
      if (tapping) {    
        tapping = false;    
        scope.$apply(attrs['ngTap'], element);
      }
      clicking = false;      
   //   touching = false;
      tapping = false;
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    element.bind('mousedown', function(e) {
      if (touching) return;
      clicking = true;
      touchstart(e);
    });

    element.bind('touchstart', function(e) {
      touching = true;
      touchstart(e)
    });

    element.bind('touchmove mousemove', touchmove);

    element.bind('touchend', touchend);

    element.bind('mouseup',  function(e) {
      if (touching || !clicking) return;
      touchend(e);
      clicking = false;
    });


      element.bind('tap click', function(e) {
      });
  };
});

Chondric.Syncable = function(options) {
    var syncable = this;

    var localIndex = {};
    var remoteIndex = {};

    var settings = syncable.settings = {
        bulkSave: false,
        saveAllToDb: function(localIndex) {},
        saveToDb: function(wrapper) {},
        removeFromDb: function(wrapper) {},
        getRemoteId: function(remoteVersion) {
            return remoteVersion.key;
        },
        merge: function(wrapper, callback) {
            // todo: default merge implementation
            // todo: merge instead of overwriting local changes 
            if (!wrapper.localId) wrapper.localId = wrapper.remoteId;

            if (!wrapper.hasLocalChanges) {
                wrapper.localVersion = wrapper.unmergedRemoteVersion;
            }

            if (wrapper.unmergedRemoteVersion) {
                wrapper.remoteVersion = wrapper.unmergedRemoteVersion;
                delete wrapper.unmergedRemoteVersion;
            }
            if (wrapper.remoteVersion) {
                wrapper.remoteId = settings.getRemoteId(wrapper.remoteVersion);
            }

            callback();
        },
        upload: function(wrapper, callback) {
            callback();
            // todo: post update
            //                                app.coreApiPost("/servers/", "", function(ns) {

            //                              })
            //                            projectSource.uploadIssue(project, wrapper, onProgress, callback);

        }
    };

    $.extend(settings, options);


    syncable.updateIndex = function(wrapper) {
        if (wrapper.remoteId) remoteIndex[wrapper.remoteId] = wrapper;
        if (wrapper.localId) localIndex[wrapper.localId] = wrapper;
    };

    // return wrapper object as it exists - local, remote or both may be unset.
    // if a new wrapper is created it will be created with the known remote id.

    syncable.getByRemoteId = function(id, callback) {
        if (remoteIndex[id]) {
            return callback(remoteIndex[id]);
        } else {
            var wrapper = {
                remoteId: id
            };
            return callback(wrapper);
        }
    };

    // local id should always be valid
    syncable.getByLocalId = function(id, callback) {
        return callback(localIndex[id]);
    };

    syncable.addNew = function(localId, localVersion) {
        var wrapper = {
            localId: localId,
            localVersion: localVersion,
            hasLocalChanges: true,
            lastModified: new Date().getTime()
        };
        syncable.updateIndex(wrapper);
        return wrapper;
    };

    syncable.save = function(wrapper) {
        syncable.updateIndex(wrapper);
        if (settings.bulkSave) {
            settings.saveAllToDb(localIndex);
        } else {
            settings.saveToDb(wrapper);
        }
    };

    syncable.queueSave = function(wrapper, lastModified, isSystemUpdate) {
        // todo: timer implementation / single bulk save
        if (!isSystemUpdate) wrapper.hasLocalChanges = true;
        wrapper.lastModified = lastModified || new Date().getTime();
        syncable.save(wrapper);

    };

    // ensure all are in the in memory list. 
    // db is not independently accessible, so no need to load any that are already present
    syncable.loadFromDbResults = function(wrappers) {
        for (var i = 0; i < wrappers.length; i++) {
            var wrapper = wrappers[i];
            if (wrapper.remoteId && remoteIndex[wrapper.remoteId]) continue;
            if (wrapper.localId && localIndex[wrapper.localId]) continue;
            syncable.updateIndex(wrapper);
        }
    };


    syncable.loadSavedLocalIndex = function(data) {
        localIndex = data;
        for (var li in data) {
            syncable.updateIndex(data[li]);
        }
    };


    syncable.sync = function(
        // object needing sync
        wrapper,
        // function to get latest version from remote. can either call web service directly or use cached results from 
        // a getAll web service. should return null if remoteId is not set.
        getRemoteVersion,
        // function to perform a 3 way merge. May create localVersion if it doesn't exist, but must use 
        // existing object if it is set. 
        mergeFunction,
        // function to upload the local version to the remote. returns the updated remote version
        uploadFunction,
        callback) {

        getRemoteVersion(wrapper.remoteId, function(newRemoteVersion) {

            wrapper.unmergedRemoteVersion = newRemoteVersion;

            (mergeFunction || settings.merge)(wrapper, function() {
                // wrapper must now have local version set.
                // if merge changed anything, hasLocalChanges will be true
                syncable.updateIndex(wrapper);
                if (wrapper.hasLocalChanges) {
                    uploadFunction(wrapper, function() {
                        // this may update remote id and unmergedRemoteVersion, and should set hasLocalChanges to false if it succeeded.
                        (mergeFunction || settings.merge)(wrapper, function() {
                            syncable.updateIndex(wrapper);
                            syncable.queueSave(wrapper, wrapper.lastModified, true);
                            callback();
                        });
                    });
                } else {
                    syncable.queueSave(wrapper, wrapper.lastModified, true);
                    callback();
                }
            });

        });
    };


    // process multiple remote objects as an object containing remoteId:remoteVersion pairs
    syncable.syncRemoteIndex = function(remoteObjects, callback) {

        // get array of keys
        var keys = [];
        for (var rk in remoteObjects) {
            keys.push(rk);
        }


        var processItem = function(i) {
            if (i >= keys.length) return callback();

            syncable.getByRemoteId(keys[i], function(wrapper) {

                syncable.sync(wrapper,

                    function(remoteId, callback) {
                        callback(remoteObjects[keys[i]]);
                    },
                    settings.merge,
                    settings.upload,


                    function() {
                        processItem(i + 1);
                    })

            });


        };

        processItem(0);

    };

    syncable.syncRemoteArray = function(remoteObjects, callback) {

    };


    syncable.syncLocalChanges = function(
        callback
    ) {
        syncable.getItems(function(item) {
            return item.hasLocalChanges;
        }, function(changedItems) {
            var loopfn = function(i) {
                if (i >= changedItems.length) return callback();
                if (changedItems[i].unmergedRemoteVersion) return loopfn(i + 1);
                syncable.sync(changedItems[i],
                    function(remoteId, callback) {
                        callback(changedItems[i].remoteVersion);
                    },
                    settings.merge,
                    settings.upload, function() {
                        loopfn(i + 1);
                    });
            };
            loopfn(0);

        });
    };


    syncable.uncache = function(filter, callback) {
        var result = [];
        for (var li in localIndex) {
            var item = localIndex[li];
            if (!filter || filter(localIndex[li])) {
                delete localIndex[li];
                delete remoteIndex[item.remoteId];
                if (!settings.bulkSave) {
                    settings.removeFromDb(item);
                }
            }
        }
        if (settings.bulkSave) {
            settings.saveAllToDb(localIndex);
        }

        callback(result);
    };


    syncable.getItems = function(filter, callback) {
        var result = [];
        for (var li in localIndex) {
            if (!filter || filter(localIndex[li])) result.push(localIndex[li]);
        }
        callback(result);
    };



    return this;
};

