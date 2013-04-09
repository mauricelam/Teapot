/**
 * Loads panoramas from Google street view or Google+. Google+ functionality added by Maurice Lam
 * 
 * Source: http://www.clicktorelease.com/code/streetViewReflectionMapping/
 */
var PanoLoader = function ( parameters ) {

    var _parameters = parameters;
    var _zoom = 3;
    var _location;
    var _panoId;
    var rotation = 0;
    var copyright = '';
    var _panoClient = new google.maps.StreetViewService();
    var onSizeChange = null;
    var onPanoramaLoad = null;
    var _canvas = null;
    var _ctx;
    var _count = 0,
        _total = 0;
    
    _canvas = document.createElement( 'canvas' );
    _ctx = _canvas.getContext( '2d' );
    
    this.setProgress = function( p ) {
        if( this.onProgress ) this.onProgress( p );
    };
    
    this.throwError = function( message ) {
        if( this.onError ) {
            this.onError( message );
            this.onError = null;
        } else {
            console.error( message );
        }
    };
    
    this.adaptTextureToZoom = function(type) {
        var scale = (type==='gplus') ? 512 : 416;
        var w = scale * Math.pow( 2, _zoom );
        var h = scale * Math.pow( 2, _zoom - 1 );
        _canvas.width = w;
        _canvas.height = h;
    };
    
    this.composeFromTile = function( x, y, texture ) {
        if (texture) {
            _ctx.drawImage( texture, x * 512, y * 512 );
        }
        _count++;
        
        var p = Math.round( _count * 100 / _total );
        this.setProgress( p );
        
        if( _count == _total ) {
            this.canvas = _canvas;
            this.rotation = rotation;
            if( this.onPanoramaLoad ) this.onPanoramaLoad();
        }
        
    };

    this.buildUrl = function (x, y) {
        return 'http://maps.google.com/cbk?output=tile&panoid=' + _panoId + '&zoom=' + _zoom + '&x=' + x + '&y=' + y + '&' + Date.now();
    };

    this.composePanorama = function() {
        this.setProgress( 0 );
        console.log( 'Loading panorama for zoom ' + _zoom + '...' );
        
        var w = Math.pow( 2, _zoom );
        var h = Math.pow( 2, _zoom - 1 );
        _count = 0;
        _total = w * h;
        
        for( var y = 0; y < h; y++ ) {
            for( var x = 0; x < w; x++ ) {
                var url = this.buildUrl(x, y);
                composeXY(x, y, url);
            }
        }

        var self = this;
        function composeXY(x, y, url) {
            var img = new Image();
            img.onload = function () {
                self.composeFromTile(x, y, this);
            };
            img.onerror = function () {
                self.composeFromTile(x, y, null);
                // self.throwError('Unable to retrieve image. Maybe the server denied the request. Please try another one. ');
            };
            img.crossOrigin = 'Anonymous';
            img.src = url;
        }
        
    };

    this.loadGPlus = function (imageUrl) {
        var img = new Image();
        var self = this;
        img.addEventListener('load', function () {
            _canvas.width = img.width;
            _canvas.height = img.height;
            _ctx.drawImage(img, 0, 0);
            self.canvas = _canvas;
            self.onPanoramaLoad();
        });
        img.onerror = function () {
            alert('Error loading the image. Maybe the picture is not hosted on Google+. Please select another one. ');
        };
        img.crossOrigin = '';
        var imageComponents = imageUrl.split('/');
        imageComponents[imageComponents.length - 2] = 'w3200';
        img.src = imageComponents.join('/');
    };

    this.loadStreetView = function (location) {
        this.location = location;
        var self = this;
        _panoClient.getPanoramaByLocation( location, 50, function( result, status ) {
            if( status == google.maps.StreetViewStatus.OK ) {
                var h = google.maps.geometry.spherical.computeHeading( location, result.location.latLng );
                rotation = result.tiles.centerHeading;
                copyright = result.copyright;
                self.copyright = result.copyright;
                _panoId = result.location.pano;
                self.composePanorama();
            } else {
                self.throwError( 'Could not retrieve panorama for the following reason: ' + status );
            }
        } );
    };
    
    this.load = function(type) {
        this.adaptTextureToZoom(type);

        var args = Array.prototype.slice.call(arguments, 1);
        if (type === 'gplus') {
            this.loadGPlus.apply(this, args);
        } else {
            this.loadStreetView.apply(this, args);
        }
    };
    
};