var path = require('path');
var fs = require('fs');
var mkdirp = require("mkdirp");
//var bower = require("bower");
var crypto = require('crypto');
var https = require('https');

exports.update = function(apphostdir, appdef) {

    var chondricdir = __dirname;
    var appdir = path.resolve(apphostdir, appdef.htmlPath);
    var generatorLogPath = apphostdir + "/chondric-generator.json";

    console.log("updating app in " + appdir);

    var genlog = {};
    if (fs.existsSync(generatorLogPath)) genlog = JSON.parse(fs.readFileSync(generatorLogPath, "utf8"));

    var generateIfSafe = function(targetPath, generator) {
        var relativePath = path.relative(apphostdir, targetPath);

        // create any folders necessary
        var targetdir = path.dirname(targetPath);
        if (!fs.existsSync(targetdir)) {
            mkdirp.sync(targetdir);
        }

        var targetExists = fs.existsSync(targetPath);
        var previouslyGenerated = genlog[relativePath];

        var resulthash;
        var filehash;

        if (!targetExists || previouslyGenerated) {
            var result = generator();
            resulthash = crypto.createHash('sha1').update(result).digest('hex');

        }

        if (targetExists && !previouslyGenerated) {
            console.log(relativePath + " was created manually - not updating");
            return;
        }

        if (targetExists && previouslyGenerated == resulthash) {
            // templates haven't changed - no need to continue
            return;
        }

        if (targetExists && previouslyGenerated) {
            filehash = crypto.createHash('sha1').update(fs.readFileSync(targetPath, "utf8")).digest('hex');
            if (filehash != previouslyGenerated) {
                if (resulthash != previouslyGenerated) {
                    // only report this if the template or appdef has caused a change
                    console.log(relativePath + " was changed - not updating");
                }
                return;
            }
        }

        // to get to here, file must equal previously generated version
        if (targetExists && filehash != previouslyGenerated) {
            throw ("This should not be possible");
        }

        if (targetExists) {
            console.log(relativePath + " found - updating");
        } else {
            console.log(relativePath + " not found - creating");
        }

        fs.writeFileSync(targetPath, result);
        genlog[relativePath] = resulthash;
        return true;
    }

    var noSubstitution = function(s) {
        return s;
    };
    var standardSubstitution = function(template, appdef, pagedef) {
        var result = template
            .replace(/__APPHOST_NAME__/g, appdef.appHost)
            .replace(/__APPTITLE__/g, appdef.title)
            .replace(/__FIRSTPAGETEMPLATE__/g, appdef.route || appdef.pages[0].route || ("/" + appdef.pages[0].id));

        if (pagedef) {
            result = result
                .replace(/__PAGEID__/g, pagedef.id)
                .replace(/__PAGEROUTE__/g, pagedef.route || ("/" + pagedef.id))
                .replace(/__PREVPAGEID__/g, pagedef.prev)
                .replace(/__NEXTPAGEID__/g, pagedef.next)
                .replace(/__ANGULARMODULES__/g, JSON.stringify(pagedef.angularModules || []))
                .replace(/__ANGULARCONTROLLER__/g, pagedef.angularController)
                .replace(/__PAGETITLE__/g, pagedef.title)
                .replace(/__TEMPLATEFOLDER__/g, pagedef.folder ? "templateFolder: \"" + pagedef.folder + "\"," : "");



        }
        return result;
    };


    var updateFile = function(targetDir, relTarget, templatePath, substitute, pagedef) {

        // todo: look for a templates folder in app folder first
        var appTemplatePath = path.resolve(path.resolve(apphostdir, "templates"), templatePath);
        var frameworkTemplatePath = path.resolve(path.resolve(chondricdir, "templates"), templatePath);
        var fullTemplatePath = fs.existsSync(appTemplatePath) ? appTemplatePath : frameworkTemplatePath;
        if (!fs.existsSync(fullTemplatePath)) {
            console.error("Unable to find template " + templatePath);
            return;
        }

        generateIfSafe(path.resolve(targetDir, relTarget), function() {
            var template = fs.readFileSync(fullTemplatePath, "utf8");
            return substitute(template, appdef, pagedef || {});
        });

    }


    if (appdef.appHost) {
        updateFile(apphostdir, "Procfile", "Procfile", standardSubstitution);
        updateFile(apphostdir, appdef.appHost + ".js", "apphost.js", standardSubstitution);
        updateFile(apphostdir, "package.json", "package.json", standardSubstitution);
        updateFile(apphostdir, ".env", "template.env", noSubstitution);
        updateFile(apphostdir, ".gitignore", "template.gitignore", noSubstitution);
        updateFile(apphostdir, ".bowerrc", "bowerrc.json", standardSubstitution);
        updateFile(apphostdir, "bower.json", "bower.json", standardSubstitution);
        updateFile(appdir, "app.js", "app.js", standardSubstitution);
        updateFile(appdir, "db.js", "db.js", standardSubstitution);
    }


    mkdirp.sync(path.resolve(appdir, "lib"));

    updateFile(appdir, "splash.html", "splash.html", standardSubstitution);
    updateFile(appdir, "icon.html", "icon.html", standardSubstitution);
    updateFile(appdir, "preview.html", "preview.html", standardSubstitution);
    updateFile(appdir, "app.css", "app.css", standardSubstitution);


    var pagetemplatepath = appdef.pageTemplate ? path.resolve(path.dirname(require.main.filename), appdef.pageTemplate) : path.resolve(chondricdir, "templates/page.html");


    var frameworkscriptrefs = "<script src=\"bower_components/jquery/dist/jquery.min.js\"></script>\n";
    frameworkscriptrefs += "<script src=\"bower_components/angular/angular.min.js\"></script>\n";
    frameworkscriptrefs += "<script src=\"bower_components/angular-sanitize/angular-sanitize.min.js\"></script>\n";
    frameworkscriptrefs += "<script src=\"bower_components/angular-ui-utils/ui-utils.min.js\"></script>\n";
    frameworkscriptrefs += "<link rel=\"stylesheet\" href=\"bower_components/pure/pure-min.css\"/>\n";

    var angularUsed = appdef.useAngular;



    var apphtmltemplatepath = fs.existsSync(path.resolve(appdir, "index.html")) ? path.resolve(appdir, "index.html") : path.resolve(chondricdir, "templates/app.html");
    var apphtmltemplate = fs.readFileSync(apphtmltemplatepath, "utf8");

    var scriptrefs = "";
    // create pages
    for (var i = 0; i < appdef.pages.length; i++) {
        var pagedef = appdef.pages[i];

        var angularController = pagedef.angularController = pagedef.angularController || (pagedef.id + "Ctrl");

        pagedef.type = pagedef.type || "page";

        if (!pagedef.scriptless) {
            var jspath = pagedef.id + ".js";
            if (pagedef.folder) jspath = pagedef.folder + "/" + jspath;
            updateFile(appdir, jspath, pagedef.type + ".js", standardSubstitution, pagedef);
            scriptrefs += "<script src=\"" + jspath + "\"></script>\n";
        }

        var htmlpath = pagedef.id + ".html";
        if (pagedef.folder) htmlpath = pagedef.folder + "/" + htmlpath;
        updateFile(appdir, htmlpath, pagedef.type + ".html", standardSubstitution, pagedef);

    }



    var apphtmltemplatepath = fs.existsSync(path.resolve(appdir, "index.html")) ? path.resolve(appdir, "index.html") : path.resolve(chondricdir, "templates/app.html");
    var apphtmltemplate = fs.readFileSync(apphtmltemplatepath, "utf8");
    var html =
        standardSubstitution(apphtmltemplate, appdef)
        .replace(/<!--BEGIN PAGESCRIPTS-->[\s\S]*<!--END PAGESCRIPTS-->/g, "<!--BEGIN PAGESCRIPTS-->" + scriptrefs + "<!--END PAGESCRIPTS-->")
        .replace(/<!--BEGIN FRAMEWORKSCRIPTS-->[\s\S]*<!--END FRAMEWORKSCRIPTS-->/g, "<!--BEGIN FRAMEWORKSCRIPTS-->" + frameworkscriptrefs + "<!--END FRAMEWORKSCRIPTS-->");

    fs.writeFileSync(path.resolve(appdir, "index.html"), html);



    fs.writeFile(path.resolve(appdir, "lib/chondric.js"), fs.readFileSync(path.resolve(chondricdir, "built/chondric.js")));
    fs.writeFile(path.resolve(appdir, "lib/chondric.min.js"), fs.readFileSync(path.resolve(chondricdir, "built/chondric.min.js")));
    fs.writeFile(path.resolve(appdir, "lib/chondric.css"), fs.readFileSync(path.resolve(chondricdir, "built/chondric.css")));
    fs.writeFile(path.resolve(appdir, "lib/chondric.min.css"), fs.readFileSync(path.resolve(chondricdir, "built/chondric.min.css")));


    fs.writeFileSync(generatorLogPath, JSON.stringify(genlog, null, 4));


};

exports.hostApp = function(options) {
    var express = exports.express = require('express');
    var newapp = false;
    var app = options.app;
    if (!app) {
        newapp = true;
        app = express();

        app.use(express.cookieParser());
        app.use(express.session(options.sessionOptions || {
            secret: 'tW876DcNV4B5N33FmVDbBq8h3p8txp'
        }));

        app.use(express.bodyParser());


    }

    var ensureAuthenticated = options.ensureAuthenticated;
    if (!ensureAuthenticated) {
        var authstarter = require("authstarter");
        authstarter.configure(app, options.authOptions);
        ensureAuthenticated = authstarter.ensureAuthenticated;
        exports.authstarter = authstarter;
    }
    app.ensureAuthenticated = ensureAuthenticated;


    app.use("/platformscripts", express.static(process.cwd() + '/platformscripts'));


    if (options.frameworkDebug) {
        if (typeof(options.frameworkDebug) != "object") options.frameworkDebug = {};
        console.log("Framework debug mode - chondric scripts will be served from module folder")
        var builtDir = path.resolve(__dirname, "built");
        var srcDir = path.resolve(__dirname, "src");

        app.use("/chondric-source", express.static(srcDir));
        /*
        "/demo/lib/dragon-drop.js": "../../dragon-drop/dragon-drop.js",
        "/demo/lib/chondric.js": ["../../chondric/src/core.js"];
        "/demo/lib/chondric.css": ["../../chondric/src/css/core.css"];
*/

        options.frameworkDebug["/demo/lib/chondric.css"] = [
            srcDir + "/css/core.css",
            srcDir + "/css/icons.css",
            srcDir + "/css/modals.css",
            srcDir + "/css/transitions/crossfade.css",
            srcDir + "/css/transitions/slideleft.css",
            srcDir + "/css/transitions/slideright.css"
        ];

        options.frameworkDebug["/demo/lib/chondric.js"] = [
            srcDir + "/core.js",
            srcDir + "/view.js",
            srcDir + "/versioneddatabase.js",
            srcDir + "/genericsync.js",
            srcDir + "/directives/ng-tap.js",
            srcDir + "/directives/cjs-popover.js",
            srcDir + "/directives/cjs-popup.js",
            srcDir + "/directives/preview-controls.js",
            srcDir + "/directives/chondric-viewport.js"
        ]

        app.use(function(req, res, next) {

            for (var k in options.frameworkDebug) {
                if (req.originalUrl.indexOf(k) == 0) {
                    var mapping = options.frameworkDebug[k];
                    if (typeof(mapping) == "string") {
                        // just send the file
                        console.log("Getting " + req.originalUrl);
                        fs.readFile(path.resolve(process.cwd(), mapping), "utf8", function(err, d) {
                            if (err) {
                                console.log(err);
                            }
                            if (mapping.indexOf(".css") > 0) res.type("text/css");
                            else if (mapping.indexOf(".js") > 0) res.type("application/javascript");
                            return res.send(d);
                        });
                        return;

                    } else {
                        var partial = req.originalUrl.substr();
                        var rrel = path.basename(req.originalUrl);
                        for (var i = 0; i < mapping.length; i++) {
                            var mrel = path.basename(mapping[i]);
                            if (rrel == mrel) {
                                console.log("Getting " + req.originalUrl);
                                fs.readFile(path.resolve(process.cwd(), mapping[i]), "utf8", function(err, d) {
                                    if (err) {
                                        console.log(err);
                                    }
                                    if (mapping[i].indexOf(".css") > 0) res.type("text/css");
                                    else if (mapping[i].indexOf(".js") > 0) res.type("application/javascript");
                                    return res.send(d);
                                });
                                return;
                            }
                        }

                    }
                }
            }


            return next();
        })

        app.get('/demo/index.html',
            function(req, res) {
                //console.log("serving framework script")
                fs.readFile(path.resolve(process.cwd(), "apphtml/index.html"), "utf8", function(err, d) {

                    for (var k in options.frameworkDebug) {
                        var mapping = options.frameworkDebug[k];
                        if (typeof(mapping) == "string") {
                            // for a single file, no need to update the url
                            continue;
                        } else {
                            var origPath = k;
                            var relPath = path.relative(path.dirname("/demo/index.html"), origPath).replace('\\', '/');
                            console.log(relPath);
                            var allscripts = "";
                            for (var i = 0; i < mapping.length; i++) {
                                var rel = path.basename(mapping[i]);
                                if (k.indexOf(".js") > 0) {
                                    allscripts += '<script src="' + k + '/' + rel + '" type="text/javascript"></script>\n';
                                } else if (k.indexOf(".css") > 0) {
                                    allscripts += '<link rel="stylesheet" href="' + k + '/' + rel + '" />\n';
                                }
                            }

                            d = d.replace('<script src="' + origPath + '" type="text/javascript"></script>', allscripts)
                            d = d.replace('<script src="' + relPath + '" type="text/javascript"></script>', allscripts)

                            d = d.replace('<link rel="stylesheet" href="' + origPath + '" />', allscripts)
                            d = d.replace('<link rel="stylesheet" href="' + relPath + '" />', allscripts)


                        }
                    }

                    res.type("text/html");
                    res.send(d);
                })
            });


        app.get('/demo/lib/chondric.js',
            function(req, res) {
                //console.log("serving framework script")
                fs.readFile(path.resolve(builtDir, "chondric.js"), "utf8", function(err, d) {
                    res.type("application/javascript");
                    res.send(d);
                })
            });
        app.get('/demo/lib/chondric.css',
            function(req, res) {
                //console.log("serving framework css")
                // fs.readFile(path.resolve(builtDir, "chondric.css"), "utf8", function(err, d) {
                fs.readFile(path.resolve(srcDir, "css/include.css"), "utf8", function(err, d) {
                    res.type("text/css");
                    res.send(d);
                })
            });
    }


    var staticMiddleware = express.static(process.cwd() + '/apphtml');
    app.get('/demo*', ensureAuthenticated, function(req, res, next) {
        if (req.path == "/demo") return res.redirect("/demo/index.html");
        req.url = req.url.replace(/^\/demo/, '');
        staticMiddleware(req, res, next);
    });

    if (options.settingsJson) {
        app.get('/settings.json', ensureAuthenticated, options.settingsJson);
    }





    exports.listen = function() {
        var port = process.env.PORT || 5000;
        if (options.sslOptions) {
            var server = https.createServer(options.sslOptions, app).listen(port, function() {
                console.log("https server listening on port " + port);
            });
        } else {
            app.listen(port, function() {
                console.log("http server listening on " + port);
            });
        }
    };

    if (newapp && !options.delayListen) {
        exports.listen();
    }

    return app;
};