(function () {
    var canvas, gl, pl, map;
    var shininessSlider, smoothnessSlider, colorPick;
    var textureAlpha, texturePicker;

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
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        streetView.init(gl, pl);
        teapot.init(gl, pl);
        teapot.texture = textures[0];
        teapot.bumpMap = textures[0];

        updateTextures();

        if (frameRequested) { return; }
        window.requestAnimFrame(drawScene);
        frameRequested = true;
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

    function initGPlus () {
        gapi.client.setApiKey('AIzaSyDofKhNhouBpHTpcT76F8fwZTTeqecDCIo');
        gapi.client.load('plus', 'v1', function () {
            var request = gapi.client.plus.activities.search({'query': 'photosphere', 'orderBy': 'recent', 'maxResults': 20});
            request.execute(function (response) {
                loadGPlusData(response.items);
            });
        });
    }
    window.initGPlus = initGPlus; // Google API SDK needs to call this

    function loadGPlusData(items) {
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
        canvas.width = document.body.clientWidth - 210;
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

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        pl.perspective(45, canvas.width / canvas.height, 0.1, 100.0);
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
            var rotation = (animateTeapot) ? (drawTime - startTime) * 0.03 : 0;
            var uniforms = {
                shininess: shininessSlider.value,
                smoothness: smoothnessSlider.value,
                color: hexToRgb(colorPick.value),
                textureAlpha: textureAlpha.value,
                bumpMapDepth: bumpMapDepth.value
            };
            teapot.draw(rotation, yaw, pitch, uniforms);
        }

        window.requestAnimFrame(drawScene);
    }

    /**
     * Event handlers
     */

    function resize () {
        canvas.width = document.body.clientWidth - 210;
        canvas.height = document.body.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
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
        if (event.keyCode === 32) {
            animateTeapot = !animateTeapot;
        } else if (event.keyCode === 61) {
            zoom += 1;
        } else if (event.keyCode === 45) {
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
    var bumpMaps = textures;

    function addExternalTexture (url) {
        var img = new Image();
        img.addEventListener('load', function () {
            var canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            var context = canvas.getContext('2d');
            var dimension = Math.min(img.width, img.height);
            context.drawImage(img, 0, 0, 512, 512);
            url = canvas.toDataURL();
            addTexture(url, true);
            teapot.texture = url;
        });
        img.crossOrigin = 'Anonymous';
        img.src = cors + url;
    }

    function addTexture (url, external) {
        var img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', function () {
            teapot.texture = url;
        });
        if (external === true) {
            texturePicker.insertBefore(img, texturePicker.lastChild);
        } else {
            texturePicker.appendChild(img);
        }
    }

    function addExternalBumpMap (url) {
        var img = new Image();
        img.addEventListener('load', function () {
            var canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            var context = canvas.getContext('2d');
            var dimension = Math.min(img.width, img.height);
            context.drawImage(img, 0, 0, 512, 512);
            url = canvas.toDataURL();
            addBumpMap(url, true);
            teapot.bumpMap = url;
        });
        img.crossOrigin = 'Anonymous';
        img.src = cors + url;
    }

    function addBumpMap (url, external) {
        var img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', function () {
            teapot.bumpMap = url;
        });
        if (external === true) {
            bumpMapPicker.insertBefore(img, bumpMapPicker.lastChild);
        } else {
            bumpMapPicker.appendChild(img);
        }
    }

    function initTeapotOptions() {
        texturePicker = document.querySelector('#texturePicker');
        textures.forEach(addTexture);
        var addTextureBtn = document.createElement('img');
        addTextureBtn.src = 'textures/add.png';
        texturePicker.appendChild(addTextureBtn);
        addTextureBtn.addEventListener('click', function () {
            var url = prompt('Enter the URL of the texture:');
            addExternalTexture(url);
        });

        bumpMapPicker = document.querySelector('#bumpMapPicker');
        bumpMaps.forEach(addBumpMap);
        var addBumpMapBtn = document.createElement('img');
        addBumpMapBtn.src = 'textures/add.png';
        bumpMapPicker.appendChild(addBumpMapBtn);
        addBumpMapBtn.addEventListener('click', function () {
            var url = prompt('Enter the URL of the texture');
            addExternalBumpMap(url);
        });
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

        document.querySelector('#changeEnvironment').addEventListener('click', changeEnvironment);

        smoothnessSlider.addEventListener('mouseup', updateTextures);
    }

    document.addEventListener('DOMContentLoaded', init);

    window.getGL = function () { return gl; }; // debug function

})();
