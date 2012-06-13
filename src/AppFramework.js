
$(document).bind("mobileinit", function() {
    $.mobile.autoInitializePage = false;

});

function BaseApp(options) {
    var app = this;
    this.ready = false;
    this.autohidesplashscreen = false;
    this.Pages = {};
    this.Actions = {};

    function getByProp(arr, prop, val) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i][prop] == val) return arr[i];
        }
    }

    var settings = {
        name: "Base App",
        scriptGroups: [],
        contexts: {},
        enableScroll: true,
        getDatabase: null,
        loadData: function(loadedctx, callback) {
            callback()
        },
        customInit: function(callback) {
            callback()
        }
    };

    $.extend(settings, options);

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

        // disable default scrolling
        if (!settings.enableScroll) {
            $(function() {
                $("body")[0].ontouchmove = function(event) {
                    event.preventDefault();
                    return false;
                };
            });
        }

        $('div[data-role="page"], div[data-role="dialog"]').live('pagecreate', PageCreated);

        $('div[data-role="dialog"]').live('pagebeforeshow', function(e, ui) {
            ui.prevPage.addClass("ui-dialog-background ");
        });

        $('div[data-role="dialog"]').live('pagehide', function(e, ui) {
            $(".ui-dialog-background ").removeClass("ui-dialog-background ");
        });

        $('[data-role="button"]').live('vclick', ButtonClick);

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

        $("#startPage").attr("data-url", document.location.pathname.replace(/\/$/, "/index.html"));
        $.mobile.initializePage();
        $.event.special.swipe.durationThreshold = 200;

        app.autohidesplashscreen && navigator && navigator.splashscreen && navigator.splashscreen.hide();

        app.ready = true;
        callback();
    }

    function isScriptless(pageid) {
        // TODO: use a better rule here
        return pageid.indexOf("help") == 0
    }

    function PageCreated(event) {
        var pageid = this.id;
        var pagediv = this;
        console.log("created page " + pageid);
        $(pagediv).attr("style", "")

        if (isScriptless(pageid)) {

            // TODO: allow this on scripted dialogs with data-autoclose attribute
            // scriptless dialogs can be closed by clicking outside
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
            app.Pages[pageid].attachEvents(pagediv);
            app.Pages[pageid].updateView(pagediv, null, true, true);
        } else {
            require(["pages/" + pageid.toLowerCase().replace(/page$/, "") + ".js"], function() {
                app.Pages[pageid].attachEvents(pagediv);
                app.Pages[pageid].updateView(pagediv, null, true, true);
            });
        }

    };

    function PageBeforeShow(event) {

        var pagediv = this;
        var pageid = this.id;

        console.log("shown page " + pageid);
        console.log("data-url = " + $(pagediv).attr("data-url"));


        $(pagediv).attr("style", "")

        if (isScriptless(pageid)) return;

        if (app.Pages[pageid]) {
            app.Pages[pageid].updateView(pagediv, null, true, false);
        } else {
            require(["pages/" + pageid.toLowerCase().replace(/page$/, "") + ".js"], function() {
                app.Pages[pageid].updateView(pagediv, null, true, false);
            });
        }
    };

    function PageShown(event) {

        var pagediv = this;
        var pageid = this.id;

        console.log("shown page " + pageid);
        console.log("data-url = " + $(pagediv).attr("data-url"));


        $(pagediv).attr("style", "")

        if (isScriptless(pageid)) return;

        if (app.Pages[pageid]) {
            app.Pages[pageid].updateView(pagediv, null, false, false);
        } else {
            require(["pages/" + pageid.toLowerCase().replace(/page$/, "") + ".js"], function() {
                app.Pages[pageid].updateView(pagediv, null, false, false);
            });
        }

    };


    function ButtonClick(event) {
        //alert("vclick");
        var link = $(this);
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


    this.init = function(callback) {
        // load required scripts
        console.log("beginning app initialization");
        var initInternal = function() {
                console.log("begin internal init");
                //	alert("running init")
                loadScripts(0, function() {
                    console.log("loaded scripts");


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
                                    complete(function() {
                                        if (callback) callback();
                                    })
                                })
                            })
                        })
                    })
                })
            };

        if (document.location.protocol == "file:") {
            // file protocol indicates phonegap
            app.isPhonegap = true;
            document.addEventListener("deviceready", function() {
                console.log("appframework deviceready");
                $(initInternal);
            }

            , false);
        } else {
            // no phonegap - web preview mode
            $(initInternal);
        }

    }
    return this;
}

function BasePage(options) {
    var page = this;

    var settings = {
        getViewModel: function(callback, pagehidden, partialupdate) {
            callback()
        },
        customEvents: function(pagediv) {},
        customValidation: function() {},
        save: function() {},
        customViewUpdate: function(pagediv, m, pagehidden, partialupdate) {},
        directionalNavigation: [],
        showNavbars: true,
        variations: {}

    }

    $.extend(settings, options);

    this.getViewModel = function(callback, pagehidden, partialupdate) {
        var page = this;
        settings.getViewModel(function(m) {
            page.model = m;
            callback(m);
        }, pagehidden, partialupdate);
    }

    this.attachEvents = function(pagediv) {
        // attach events for the pages subviews using live - this runs on page create, so in updateview
        // we only need to update the dom elements / attributes
        // all syncronous and does not rely on anything being loaded until the event handlers are called.
        var page = this;

        // split directional nav array


        // bind swipe events

        $(pagediv).bind("swipe", function(e, data) {

            $(".swipenav." + data.direction).click();

            return false;
            // TODO: return true if no swipe event available

        })

        // saving for dialogs
        if (settings.rules) {
            // validation enabled

            $("#frmInput", pagediv).validate({
                rules: settings.rules,
                submitHandler: function(form) {
                    page.save.call(page, pagediv);
                    $('.ui-dialog').dialog('close');
                },
                invalidHandler: function(form, validator) {
                    var errors = validator.numberOfInvalids();
                    if (errors) {
                        //	var message = errors == 1 ? 'You missed 1 field. It has been highlighted' : 'You missed ' + errors + ' fields. They have been highlighted';
                        //	alert(message);
                    }
                }
            });

        } else {
            // no validation, just save
            $("#btnSave", pagediv).click(function() {
                page.save(pagediv);
                $('.ui-dialog').dialog('close');
                return false;
            });
        }

        $(pagediv).bind('orientationchange', function(event) {
            // for some reason changing back to portrait causes horizontal scrolling
            window.scrollTo(0, window.scrollY);

            page.updateView(pagediv, page.model)
        });

        settings.customEvents.call(page, pagediv)

        //  variation events

        for (var vn in settings.variations) {
            var vc = settings.variations[vn];
            if (!vc) {
                continue;
            }
            var vd = $("#" + vn, pagediv);
            if (vd.length != 1) {
                continue;
            }
            if (vc.attach) {
                vc.attach(page, vd);
            }
        }

    }

    this.save = function(pagediv) {

        // TODO: update model from field values

        var m = this.model;
        $("[data-role='autoedit']", pagediv).each(function() {
            // simple properties can be handled declaratively
            var element = $(this);

            // skip items that are not immediate children of the subview - i.e. they have
            // no viewTemplate ancestor and the closest view ancestor is this subview
            var viewTemplateAncestor = $(this).closest("[data-role=viewTemplate]");
            var viewAncestor = $(this).closest("[data-role=view],[data-role=page],[data-role=dialog]");
            if (viewTemplateAncestor.length > 0) return;
            if (viewAncestor[0] != pagediv) return;

            var propName = $(this).attr("data-property");
            m[propName] = element.val();
        });

        settings.save.call(page, pagediv, m);
    }

    function showDirectionalNav(pagediv, m) {

        var sidebars = {
            left: null,
            right: null,
            up: null,
            down: null
        }

        for (var i = 0; i < settings.directionalNavigation.length; i++) {
            var n = settings.directionalNavigation[i]
            if (!n.enabled || n.enabled(m)) {
                sidebars[n.direction] = n;
            }
        }

        for (var dir in sidebars) {
            var sbd = sidebars[dir]
            if (sbd) {
                if ($.isFunction(sbd.url)) {
                    $(".swipenav." + dir).attr("href", sbd.url(m));
                } else {
                    $(".swipenav." + dir).attr("href", sbd.url);
                }

                if ($.isFunction(sbd.title)) {
                    $(".swipenav." + dir).html(sbd.title(m));
                } else {
                    $(".swipenav." + dir).html(sbd.title);
                }


                $(".swipenav." + dir).addClass("enabled");

            } else {
                $(".swipenav." + dir).removeClass("enabled");
            }
        }


    }

    function updateViewInternal(pagediv, m, pagehidden, partialupdate) {
        // TODO: standard declared updates

        // show variations

        for (var vn in settings.variations) {
            var vc = settings.variations[vn];
            if (!vc) {
                continue;
            }
            var vd = $("#" + vn, pagediv);
            if (vd.length != 1) {
                continue;
            }
            var visibleVariationUpdated = false;
            if (!vc.condition || vc.condition(m)) {
                $(".pagevariation", pagediv).removeClass("active");
                vd.addClass("active");
                if (!visibleVariationUpdated && vc.update) {
                    vc.update(page, vd, m);
                }
                visibleVariationUpdated = true;
                break;
            }
        }

        // autopopulate

        $("[data-role='autopopulate']", pagediv).each(function() {
            // simple properties can be handled declaratively
            var element = $(this);

            // skip items that are not immediate children of the subview - i.e. they have
            // no viewTemplate ancestor and the closest view ancestor is this subview
            var viewTemplateAncestor = $(this).closest("[data-role=viewTemplate]");
            var viewAncestor = $(this).closest("[data-role=view],[data-role=page]");
            if (viewTemplateAncestor.length > 0) return;
            if (viewAncestor[0] != pagediv) return;

            var propName = $(this).attr("data-property");
            var val = m[propName];
            element.html(val);

        });
        // autoedit

        $("[data-role='autoedit']", pagediv).each(function() {
            // simple properties can be handled declaratively
            var element = $(this);

            // skip items that are not immediate children of the subview - i.e. they have
            // no viewTemplate ancestor and the closest view ancestor is this subview
            var viewTemplateAncestor = $(this).closest("[data-role=viewTemplate]");
            var viewAncestor = $(this).closest("[data-role=view],[data-role=page],[data-role=dialog]");
            if (viewTemplateAncestor.length > 0) return;
            if (viewAncestor[0] != pagediv) return;

            var propName = $(this).attr("data-property");
            var val = m[propName];
            console.log("value " + val);


            element.val(val);

        });
        if (!pagehidden) {
            // show directional navigation indicators if necessary
            // since the indicators are global, this should only run when the page is actually visible.
            showDirectionalNav.call(page, pagediv, m);
        }

        settings.customViewUpdate.call(page, pagediv, m, pagehidden, partialupdate);
    }


    this.updateView = function(pagediv, m, pagehidden, partialupdate) {
        if (!m) {
            page.getViewModel.call(page, function(m) {
                updateViewInternal(pagediv, m, pagehidden, partialupdate)
            }, pagehidden, partialupdate);
        } else {
            updateViewInternal(pagediv, m, pagehidden, partialupdate)
        }
    }
    return this;
}

var QuickView = function(container, options) {
        var view = this;
        var settings = {
            change: function(val) {},
            fields: {}
        }

        $.extend(settings, options);


        this.initField = function(fieldname) {
            var field = settings.fields[fieldname];
            if (!field) {
                console.log("field not found");
                return;
            }

            if (field.selector && field.element == undefined) {
                field.element = $(field.selector, container);

                field.element.bind("change keyup", function() {
                    var newVal = undefined;
                    if (field.get) {
                        // custom getter
                        console.log("custom get on change " + fieldname);
                        newVal = field.get(field.element)
                    } else {
                        console.log("standard get on change " + fieldname);
                        newVal = field.element.val();
                    }

                    if (newVal != field.currentValue) {
                        field.currentValue = newVal;
                        console.log("changed " + fieldname);
                        if (field.change) {
                            console.log("calling change " + fieldname);
                            field.change(field.currentValue);
                        }
                    }


                });

            }
        }

        for (var fn in settings.fields) {
            view.initField(fn);
        }

        this.prop = function(fieldname, value, shouldTriggerChange) {
            var field = settings.fields[fieldname];
            if (!field) {
                console.log("field not found");
                return;
            }
            // init field if not already set up
            if (field.selector && field.element == undefined) {
                view.initField(fieldname);
            }
            if (value === undefined) {
                if (field.currentValue === undefined) {
                    if (field.get) {
                        // custom getter
                        console.log("custom get " + fieldname);

                        return field.currentValue = field.get(field.element)
                    } else {
                        console.log("standard get " + fieldname);

                        return field.currentValue = field.element.val();
                    }
                } else {
                    console.log("get from cache " + fieldname);
                    return field.currentValue;
                }
                // get value;
            } else {
                // set value
                if (value == field.currentValue) {
                    console.log("unchanged " + fieldname);
                    return;
                }
                if (field.set) {
                    // custom setter
                    console.log("custom set " + fieldname);
                    field.currentValue = field.set(field.element, field.currentValue = value)
                } else {
                    console.log("standard set " + fieldname);
                    field.element.val(field.currentValue = value);
                }
                console.log("changed " + fieldname);
                if (shouldTriggerChange && field.change) {
                    console.log("calling change " + fieldname);
                    field.change(field.currentValue);
                }

            }
        };


        this.invalidate = function(fieldname) {
            if (fieldname == undefined) {
                for (var fn in settings.fields) {
                    delete settings.fields[fn].currentValue;
                }
            } else {
                var field = settings.fields[fieldname];
                if (!field) {
                    console.log("field not found");
                    return;
                }
                delete field.currentValue;
            }



        };

    };