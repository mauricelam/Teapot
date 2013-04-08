(function () {
    var canvas, gl, pl, map;
    var shininessSlider, smoothnessSlider, colorPick;
    var textureAlpha, bumpMapDepth, shadowDepth;
    var textureDrop, bumpMapDrop;
    var shadowBuffer, shadowTexture;
    var downsample512, downsample256, boxFilter;

    var supportDerivative;

    var panoObj;

    var animateTeapot = false;

    var startTime, lastDraw;
    var downPos, pitch = 0.0, yaw = 0.0, panoRotation = 0;
    var streetViewCanvas, originalStreetViewCanvas;
    var fps = document.querySelector('#fps');
    var zoom = -9.0;

    var frameRequested = false;

    /**
     * Initialization
     */

    function updateTextures () {
        if (!streetViewCanvas) {
            streetViewCanvas = document.createElement('canvas');
            streetViewCanvas.width = originalStreetViewCanvas.width / 2;
            streetViewCanvas.height = originalStreetViewCanvas.height / 2;
        }
        var context = streetViewCanvas.getContext('2d');
        context.drawImage(originalStreetViewCanvas, 0, 0, streetViewCanvas.width, streetViewCanvas.height);
        var blurRadius = smoothnessSlider.value * 50;
        boxBlurCanvasRGB(streetViewCanvas, 0, 0, streetViewCanvas.width, streetViewCanvas.height, blurRadius, 1);
        teapot.setReflectionCanvas(streetViewCanvas);
    }

    function initGL () {
        supportDerivative = gl.getExtension('OES_standard_derivatives');
        if (!supportDerivative)
            console.warn('Your browser does not support WebGL derivatives');
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        streetView.init(gl, pl);
        teapot.init(gl, pl);
        teapot.texture = textures[0];
        teapot.bumpMap = textures[0];

        initShadowBuffer();

        updateTextures();

        if (frameRequested) { return; }
        window.requestAnimFrame(drawScene);
        frameRequested = true;
    }

    function initShadowBuffer () {
        shadowBuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
        shadowBuffer.width = 1024;
        shadowBuffer.height = 1024;

        shadowTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowBuffer.width, shadowBuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        var renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowBuffer.width, shadowBuffer.height);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTexture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        downsample512 = new Filter(gl, 512, 'return get(0.0, 0.0);');
        downsample256 = new Filter(gl, 256, 'return get(0.0, 0.0);');
        boxFilter = new Filter(gl, 256, 'vec3 result = vec3(0.0);for(int x=-1; x<=1; x++){for(int y=-1; y<=1; y++){result += get(x,y);}}return result/9.0;');
    }

    function initMap () {
        var siebel = new google.maps.LatLng(40.11389722, -88.2240133);
        var myOptions = {
            zoom: 15,
            center: siebel,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map( document.querySelector('#map'), myOptions );
        var panoCanvas = document.createElement('canvas');
        panoObj = new google.maps.StreetViewPanorama(panoCanvas, { pov: { heading: 90, pitch: 0 } });
        map.setStreetView(panoObj);
        google.maps.event.addListener(panoObj, 'position_changed', function () {
            loadPanorama('map', panoObj.getPosition());
        });
        panoObj.setPosition(siebel);
    }

    function initGPlus (page) {
        page = page;
        gapi.client.setApiKey('AIzaSyDofKhNhouBpHTpcT76F8fwZTTeqecDCIo');
        gapi.client.load('plus', 'v1', function () {
            var request = gapi.client.plus.activities.search({'query': 'photosphere', 'orderBy': 'recent', 'maxResults': 20, 'pageToken': page });
            request.execute(function (response) {
                loadGPlusData(response.items, response.nextPageToken);
            });
        });
    }
    window.initGPlus = initGPlus; // Google API SDK needs to call this

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

        gplus.removeEventListener('scroll', gplus.scrollListener);
        gplus.scrollListener = function () {
            if (gplus.scrollTop + gplus.offsetHeight >= gplus.scrollHeight) {
                initGPlus(pageToken);
            }
        };
        gplus.addEventListener('scroll', gplus.scrollListener);

        function imageDFS(object) {
            // if (object.fullImage) { return object.fullImage; }
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
        if (!gl) throw ('Could not initialize WebGL');
        pl = Object.create(Pipeline);
        pl.gl = gl;
        initMap();
        initEventHandlers();
        initTeapotOptions();
        startTime = performance.now();
    }

    // http://www.clicktorelease.com/code/streetViewReflectionMapping/
    function loadPanorama(type, args) {
        document.querySelector('#controls').setAttribute('type', type);
        canvas.style.visibility = 'hidden';
        loader = new PanoLoader( { useWebGL: false } );
        loader.onSizeChange = function() { 
        };
        loader.onProgress = function( p ) {
        };
        loader.onError = function( message ) {
            alert(message);
        };
        loader.onPanoramaLoad = function() {
            canvas.style.visibility = 'visible';
            originalStreetViewCanvas = this.canvas;
            (frameRequested) ? updateTextures() : initGL();
            streetView.setCanvas(this.canvas);
            panoRotation = (this.rotation || 0) + 90;
            panoObj.setPov({ heading: yaw + panoRotation, pitch: pitch });
        };

        loader.load(type, args);
    }

    /**
     * Draw
     */
    function drawScene() {
        var drawTime = performance.now();

        if (lastDraw && drawTime % 4 < 1) { fps.textContent = Math.round(1000/(drawTime - lastDraw)); }
        lastDraw = drawTime;

        var rotation = (animateTeapot) ? (drawTime - startTime) * 0.03 : 180;
        var uniforms = {
            shininess: shininessSlider.value,
            smoothness: smoothnessSlider.value,
            color: hexToRgb(colorPick.value),
            textureAlpha: textureAlpha.value,
            bumpMapDepth: bumpMapDepth.value,
            shadowDepth: shadowDepth.value,
            lightVector: [0.5, 3.0, 0.5]
        };

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        pl.perspective(60, 1, 0.01, 100.0);
        pl.loadIdentity();

        // Draw shadow
        if (supportDerivative) {
            gl.viewport(0, 0, shadowBuffer.width, shadowBuffer.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            var lightVector = uniforms.lightVector;
            
            pl.lookAt(lightVector, [0, 0, 0], [0, 1, 0]);
            pl.pushMatrix();
            teapot.drawShadow(rotation, uniforms);
            pl.popMatrix();
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            // teapot.drawShadow(rotation, uniforms);
            downsample512.apply(shadowTexture);
            downsample256.apply(downsample512.output);
            boxFilter.apply(downsample256.output);
        }
        // window.requestAnimFrame(drawScene);
        // return;

        gl.viewport(0, 0, canvas.width, canvas.height);
        pl.perspective(60, canvas.width / canvas.height, 0.1, 100.0);
        pl.loadIdentity();

        pl.translate([0.0, 0.0, zoom]);
        pl.rotate(pitch, [1, 0, 0]);
        pl.rotate(yaw, [0, 1, 0]);
        
        pl.pushMatrix();
        { // Braces for readibility. No scoping or sematic meaning. 
            streetView.draw();
        }
        pl.popMatrix();

        {
            teapot.draw(rotation, yaw, pitch, boxFilter.output, uniforms);
        }

        window.requestAnimFrame(drawScene);
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
            yaw -= (event.pageX - downPos[0]) * 0.2;
            pitch -= (event.pageY - downPos[1]) * 0.2;
            downPos = [event.pageX, event.pageY];
            panoObj.setPov({ heading: yaw + panoRotation, pitch: pitch });
        }
    }

    function keypress (event) {
        if (event.charCode === 32) {
            animateTeapot = !animateTeapot;
        } else if (event.charCode === 61) {
            zoom += 1;
        } else if (event.charCode === 45) {
            zoom -= 1;
        }
    }

    function changeEnvironment () {
        var controls = document.querySelector('#controls');
        controls.classList.toggle('expanded');
        google.maps.event.trigger(map, 'resize');
    }

    var cors = 'http://projects.mauricelam.com/utils/cors.php?url=';

    var textures = [
        'textures/plain.png',
        'textures/checker.gif',
        'textures/dirt.jpg',
        'textures/america.jpg',
        'textures/teapot.png',
        'textures/marble.jpg',
        'textures/fur.jpg',
        'textures/world.jpg'
    ];

    function processExternalImage (url, callback) {
        // console.log(url, location.origin);
        if (url.indexOf(location.host) > -1) {
            // The URL is already safe
            console.log('safe URL');
            callback(url);
            return;
        }

        // Do some CORS magic, and crop the picture
        var img = new Image();
        img.addEventListener('load', function () {
            var canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            var context = canvas.getContext('2d');
            var dimension = Math.min(img.width, img.height);
            context.drawImage(img, 0, 0, 512, 512);
            url = canvas.toDataURL();
            callback(url);

            var libraryItem = document.createElement('img');
            libraryItem.src = url;
            document.querySelector('#imageLibrary').appendChild(libraryItem);
        });
        img.addEventListener('error', function (event) {
            throw 'Cannot load image: ' + img.src;
        });
        img.crossOrigin = 'Anonymous';
        img.src = cors + url;
    }

    function addImageToLibrary (url, external) {
        var library = document.querySelector('#imageLibrary');
        var img = document.createElement('img');
        img.src = url;
        if (external === true) {
            library.insertBefore(img, texturePicker.lastChild);
        } else {
            library.appendChild(img);
        }
    }

    function initTeapotOptions() {
        texturePicker = document.querySelector('#texturePicker');
        textures.forEach(addImageToLibrary);
        // var addTextureBtn = document.createElement('img');
        // addTextureBtn.src = 'textures/add.png';
        // texturePicker.appendChild(addTextureBtn);

        textureDrop = document.querySelector('#textureDrop');

        textureDrop.addEventListener('dragenter', function (event) {
            var types = Array.prototype.slice.call(event.dataTransfer.types);
            if (types.indexOf('text') > -1)
                event.preventDefault();
        });
        textureDrop.addEventListener('dragover', function (event) { event.preventDefault(); });
        textureDrop.addEventListener('drop', function (event) {
            var url = event.dataTransfer.getData('text') || event.dataTransfer.getData('text/uri-list');
            if (url) {
                processExternalImage(url, setTexture);
                event.dropEffect = 'copy';
                event.preventDefault();
            } else {
                alert('No supported image URLs');
            }
        });

        bumpMapDrop = document.querySelector('#bumpMapDrop');
        bumpMapDrop.addEventListener('dragenter', function (event) {
            var types = Array.prototype.slice.call(event.dataTransfer.types);
            if (types.indexOf('text') > -1)
                event.preventDefault();
        });
        bumpMapDrop.addEventListener('dragover', function (event) { event.preventDefault(); });
        bumpMapDrop.addEventListener('drop', function (event) {
            var url = event.dataTransfer.getData('text') || event.dataTransfer.getData('text/uri-list');
            if (url) {
                processExternalImage(url, setBumpMap);
                event.dropEffect = 'copy';
                event.preventDefault();
            } else {
                alert('No supported image URLs');
            }
        });
    }

    function setTexture (url) {
        teapot.texture = url;
        textureDrop.querySelector('.preview').style.backgroundImage = 'url(' + url + ')';
    }

    function setBumpMap (url) {
        teapot.bumpMap = url;
        bumpMapDrop.querySelector('.preview').style.backgroundImage = 'url(' + url + ')';
    }

    function initEventHandlers () {
        canvas.addEventListener('mousemove', mousemove);
        canvas.addEventListener('mousedown', mousedown);
        canvas.addEventListener('mouseup', mouseup);

        document.addEventListener('keypress', keypress);
        window.addEventListener('resize', resize);

        shininessSlider = document.querySelector('#shininess');
        smoothnessSlider = document.querySelector('#smoothness');
        colorPick = document.querySelector('#color');
        $('#colorpicker').farbtastic('#color');
        textureAlpha = document.querySelector('#textureAlpha');
        bumpMapDepth = document.querySelector('#bumpMapDepth');
        shadowDepth = document.querySelector('#shadowDepth');

        document.querySelector('#changeEnvironment').addEventListener('click', changeEnvironment);

        smoothnessSlider.onchange = function (event) {
            window.clearTimeout(smoothnessSlider.timeout);
            smoothnessSlider.timeout = window.setTimeout(function () {
                updateTextures();
            }, 200);
        };
        window.smoothnessSlider = smoothnessSlider;

        document.addEventListener('drop', function (event) { event.preventDefault(); });
    }

    document.addEventListener('DOMContentLoaded', init);

    window.getGL = function () { return gl; }; // debug function

})();
