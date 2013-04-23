/**
 * The entry point of all the code. This is the place where it all starts. Performs the
 * initialization and glues different parts of code together.
 */

(function () {
    var canvas, gl, pl, map;
    var controls = {};
    var textureDrop, bumpMapDrop;
    var shadowBuffer, shadowTexture;

    var panoObj;

    var animateTeapot = true, teapotRotation = 0;

    var startTime, lastDraw;
    var downPos, yawPitch = [0, 0], panoRotation = 0;
    var streetViewCanvas, originalStreetViewCanvas;
    var fps = document.querySelector('#fps');
    var zoom = -4.0;

    var frameRequested = false;

    /**
     * Call to update the textures. Sets in texture images and render a blurred version of the
     * environment.
     */
    function updateTextures () {
        if (!streetViewCanvas) {
            streetViewCanvas = document.createElement('canvas');
            streetViewCanvas.width = originalStreetViewCanvas.width / 2;
            streetViewCanvas.height = originalStreetViewCanvas.height / 2;
        }
        streetView.setCanvas(originalStreetViewCanvas);
        var context = streetViewCanvas.getContext('2d');
        context.drawImage(originalStreetViewCanvas, 0, 0, streetViewCanvas.width, streetViewCanvas.height);
        var blurRadius = controls.reflectionBlur.value * 50;
        boxBlurCanvasRGB(streetViewCanvas, 0, 0, streetViewCanvas.width, streetViewCanvas.height, blurRadius, 1);
        teapot.setReflectionCanvas(streetViewCanvas);
    }

    function initGL () {
        gl.supportDerivatives = gl.getExtension('OES_standard_derivatives');
        if (!gl.supportDerivatives)
            console.warn('Your browser does not support WebGL derivatives. Shadows will not be rendered');
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        streetView.init(gl, pl);
        teapot.init(gl, pl);

        setTexture(textures[8]);
        setBumpMap(textures[1]);
        updateTextures();

        initShadowBuffer();

        frameRequested = frameRequested || window.requestAnimFrame(drawScene);
    }

    function initShadowBuffer () {
        shadowBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
        shadowBuffer.width = 1024;
        shadowBuffer.height = 1024;

        shadowTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowBuffer.width, shadowBuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        var renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowBuffer.width, shadowBuffer.height);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function initMap () {
        var siebel = new google.maps.LatLng(40.11389722, -88.2240133);
        var mapOptions = {
            zoom: 15,
            center: siebel,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map(document.querySelector('#map'), mapOptions);

        // Create a canvas to hold the panoroma so Google Maps doesn't overlay it on top of the map
        var panoCanvas = document.createElement('canvas');
        panoObj = new google.maps.StreetViewPanorama(panoCanvas, { pov: { heading: 90, pitch: 0 } });
        map.setStreetView(panoObj);

        // Detect position change
        google.maps.event.addListener(panoObj, 'position_changed', function () {
            loadPanorama('map', panoObj.getPosition());
        });
        panoObj.setPosition(siebel);
    }

    /**
     * Load the content of #photospheres from Google+
     */
    function initGPlus (page) {
        gapi.client.setApiKey('AIzaSyDjetx8Cmd_03PuCUCuku5-ILxFsh9riPQ');
        gapi.client.load('plus', 'v1', function () {
            var request = gapi.client.plus.activities.search({'query': 'photosphere', 'orderBy': 'recent', 'maxResults': 20, 'pageToken': page });
            request.execute(function (response) {
                loadGPlusData(response.items, response.nextPageToken);
            });
        });
    }
    window.initGPlus = initGPlus; // Google API SDK needs to call this

    /**
     * Put the Google plus data into the frame.
     */
    function loadGPlusData(items, pageToken) {
        var gplus = document.querySelector('#gplus');
        items.forEach(function (item) {
            var image = imageDFS(item.object);
            if (image === null) { return; }

            var preview = document.createElement('img');
            preview.src = image.url;
            preview.addEventListener('click', function () {
                console.log(item.object);
                loadPanorama('gplus', image.url);
            }, false);
            gplus.appendChild(preview);
        });

        // Load new items when scrolled to bottom
        gplus.removeEventListener('scroll', gplus.scrollListener);
        gplus.scrollListener = function () {
            if (gplus.scrollTop + gplus.offsetHeight >= gplus.scrollHeight) {
                initGPlus(pageToken);
            }
        };
        gplus.addEventListener('scroll', gplus.scrollListener);

        // Recursively search for an image attachment
        function imageDFS(object) {
            if (object.image) { return object.image; }
            if (object.thumbnails) { return imageDFS(object.thumbnails[0]); }
            if (object.attachments) { return imageDFS(object.attachments[0]); }
            return null;
        }
    }

    function init () {
        canvas = document.querySelector('#canvas');
        canvas.width = document.body.clientWidth - 250;
        canvas.height = document.body.clientHeight;
        try {
            gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            gl.viewport(0, 0, canvas.width, canvas.height);
        } catch (e) {}
        if (!gl) alert('Error: Could not initialize WebGL. Perhaps your browser does not support it. Try using Chrome instead. ');
        pl = Object.create(Pipeline);
        pl.gl = gl;
        initMap();
        initEventHandlers();
        initTeapotOptions();
        startTime = performance.now();
    }

    /**
     * Loads a equirectangular sphere map according to the type and the argument.
     *
     * Street view -- type: 'map', args: google.location.LatLng
     * Google+ -- type: 'gplus', args: URL of the (thumbnail) image
     */
    function loadPanorama(type, args) {
        // Update the attribute so that CSS are updated accordingly
        document.querySelector('#controls').setAttribute('type', type);
        // Visual cue that the environment is loading
        canvas.style.visibility = 'hidden';

        loader = new PanoLoader( { useWebGL: false } );
        loader.onError = function (message) { alert(message); };
        loader.onPanoramaLoad = function() {
            canvas.style.visibility = 'visible';
            originalStreetViewCanvas = this.canvas;
            if (frameRequested)
                updateTextures();
            else
                initGL();
            panoRotation = (this.rotation || 0) + 90;
            panoObj.setPov({ heading: yawPitch[0] + panoRotation, pitch: yawPitch[1] });
        };

        loader.load(type, args);
    }

    var uniforms = {};
    var lightVector = [-2.0, 2.0, 4.0],
        xAxis = [1,0,0],
        yAxis = [0,1,0],
        origin = [0,0,0];

    /**
     * Draw scene function. Executed on every frame.
     */
    function drawScene() {
        var drawTime = performance.now();

        // Update the FPS, but not on every frame
        if (lastDraw && drawTime % 4 < 1) { fps.textContent = Math.round(1000/(drawTime - lastDraw)); }
        lastDraw = drawTime;

        if (animateTeapot) teapotRotation += 0.6;

        uniforms.uShininess = controls.shininess.value;
        uniforms.uSmoothness = controls.reflectionBlur.value;
        uniforms.uColor = hexToRgb(controls.colorPick.value);
        uniforms.uTextureAlpha = controls.textureAlpha.value;
        uniforms.uBumpMapDepth = controls.bumpMapDepth.value;
        uniforms.uShadowDepth = controls.shadowDepth.value;
        uniforms.uLightVector = lightVector;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        pl.perspective(80, 1, 0.01, 100.0);
        pl.loadIdentity();

        // Shadow pass
        if (gl.supportDerivatives) {
            gl.viewport(0, 0, shadowBuffer.width, shadowBuffer.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            pl.lookAt(lightVector, origin, yAxis);
            pl.pushMatrix();
            teapot.drawShadow(teapotRotation, uniforms);
            pl.popMatrix();
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        // Actual draw
        gl.viewport(0, 0, canvas.width, canvas.height);
        pl.perspective(60, canvas.width / canvas.height, 0.1, 100.0);
        pl.loadIdentity();

        pl.translate(0, 0, zoom);
        pl.rotate(yawPitch[1], xAxis);
        pl.rotate(yawPitch[0], yAxis);
        
        pl.pushMatrix();
        streetView.draw();
        pl.popMatrix();

        teapot.draw(teapotRotation, yawPitch, shadowTexture, uniforms);

        // request next frame
        window.requestAnimFrame(drawScene);
    }

    /**
     * Options functions
     */

    function changeEnvironment () {
        $('#controls').toggleClass('expanded');
        google.maps.event.trigger(map, 'resize');
    }

    // Cross-origin resource sharing
    // Because the browser doesn't not allow cross origin by default, fetch it from a server and
    // then pass it down.
    var cors = 'http://projects.mauricelam.com/utils/cors.php?url=';

    // List of available textures initially available in the library
    var textures = [
        'textures/plain.png',
        'textures/checker.gif',
        'textures/dirt.jpg',
        'textures/america.jpg',
        'textures/teapot.png',
        'textures/marble.jpg',
        'textures/world.jpg',
        'textures/roof.jpg',
        'textures/wood.jpg',
        'textures/android.png',
        'textures/apple.png'
    ];

    /**
     * Process an external image URL, and returns a CORS safe, image URL resized to 512x512.
     */
    function processExternalImage (url, callback) {
        // console.log(url, location.origin);
        if (url.indexOf(location.host) > -1 || url.indexOf('data:image') === 0) {
            // The URL is already safe
            console.log('safe URL');
            callback(url);
            return;
        }

        // Do some CORS magic, and resize the picture
        var img = new Image();
        img.addEventListener('load', function () {
            // Resize image to 512 x 512
            var canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            var context = canvas.getContext('2d');
            var dimension = Math.min(img.width, img.height);
            // Resize (and stretch) the image to fit the canvas
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            url = canvas.toDataURL();
            if (typeof callback === 'function') callback(url);

            var libraryItem = document.createElement('img');
            libraryItem.src = url;
            document.querySelector('#imageLibrary').appendChild(libraryItem);
        });
        img.addEventListener('error', function (event) { throw 'Cannot load image: ' + img.src; });
        img.crossOrigin = 'Anonymous';
        img.src = cors + url;
    }

    function addImageToLibrary (url, external) {
        var library = document.querySelector('#imageLibrary');
        var img = document.createElement('img');
        img.src = url;
        library.appendChild(img);
    }

    function initTeapotOptions() {
        textures.forEach(addImageToLibrary);

        bumpMapDrop = document.querySelector('#bumpMapDrop');
        textureDrop = document.querySelector('#textureDrop');

        textureDrop.addEventListener('dragenter', dragAndDrop.acceptTypes(['text']));
        textureDrop.addEventListener('dragover', dragAndDrop.preventDefault);
        textureDrop.addEventListener('drop', 
            dragAndDrop.drop('copy', ['text', 'text/uri-list'], function (data) {
                processExternalImage(data, setTexture);
            })
        );

        bumpMapDrop.addEventListener('dragenter', dragAndDrop.acceptTypes(['text']));
        bumpMapDrop.addEventListener('dragover', dragAndDrop.preventDefault);
        bumpMapDrop.addEventListener('drop', 
            dragAndDrop.drop('copy', ['text', 'text/uri-list'], function (data) {
                processExternalImage(data, setBumpMap);
            })
        );

        $('#addImage').click(function (event) {
            event.preventDefault();
            var url = prompt('Enter the URL of the image');
            if (url) processExternalImage(url);
        });

        controls.shininess = document.querySelector('#shininess');
        controls.reflectionBlur = document.querySelector('#smoothness');
        controls.textureAlpha = document.querySelector('#textureAlpha');
        controls.bumpMapDepth = document.querySelector('#bumpMapDepth');
        controls.shadowDepth = document.querySelector('#shadowDepth');
        controls.colorPick = document.querySelector('#color');
        $('#colorpicker').farbtastic('#color');

        controls.reflectionBlur.onchange = function (event) {
            window.clearTimeout(controls.reflectionBlur.timeout);
            controls.reflectionBlur.timeout = window.setTimeout(updateTextures, 200);
        };
    }

    function setTexture (url) {
        teapot.texture = url;
        $(textureDrop).find('.preview').css('backgroundImage', 'url(' + url + ')');
    }

    function setBumpMap (url) {
        teapot.bumpMap = url;
        $(bumpMapDrop).find('.preview').css('backgroundImage', 'url(' + url + ')');
    }

    /**
     * Event handlers
     */

    function resize () {
        canvas.width = document.body.clientWidth - 250;
        canvas.height = document.body.clientHeight;
    }

    function mousedown (event) {
        document.querySelector('#controls').classList.remove('expanded');
        downPos = [event.pageX, event.pageY];
    }

    function mouseup (event) {
        downPos = null;
    }

    function mousemove (event) {
        if (downPos) {
            yawPitch[0] -= (event.pageX - downPos[0]) * 0.2;
            yawPitch[1] -= (event.pageY - downPos[1]) * 0.2;
            downPos = [event.pageX, event.pageY];
            panoObj.setPov({ heading: yawPitch[0] + panoRotation, pitch: yawPitch[1] });
        }
    }

    function keypress (event) {
        if (event.charCode === 32) {
            animateTeapot = !animateTeapot;
            event.preventDefault();
        } else if (event.charCode === 61) {
            zoom += 1;
        } else if (event.charCode === 45) {
            zoom -= 1;
        }
    }

    function initEventHandlers () {
        document.querySelector('#changeEnvironment').addEventListener('click', changeEnvironment);

        canvas.addEventListener('mousemove', mousemove);
        canvas.addEventListener('mousedown', mousedown);
        canvas.addEventListener('mouseup', mouseup);

        document.addEventListener('keypress', keypress);
        document.addEventListener('drop', dragAndDrop.preventDefault);

        window.addEventListener('resize', resize);
    }

    document.addEventListener('DOMContentLoaded', init);

    /**
     * Some helper functions to aid in Drag and Drop operations.
     */
    var dragAndDrop = {
        preventDefault: function (e) { e.preventDefault(); },
        acceptTypes: function (types) {
            return function (e) {
                var eventTypes = Array.prototype.slice.call(event.dataTransfer.types);
                types.forEach(function (type) {
                    if (eventTypes.indexOf(type) > -1)
                        event.preventDefault();
                });
            };
        },
        drop: function (action, types, success) {
            return function (e) {
                var url;
                for (var i = 0, count = types.length; i < count; i++) {
                    url = e.dataTransfer.getData(types[i]);
                    if (url) break;
                }
                if (url) {
                    success(url);
                    event.dropEffect = action;
                    event.preventDefault();
                } else {
                    alert('No supported image URLs');
                }
            };
        }
    };

})();