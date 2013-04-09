/**
 * Convert Hexadecimal RGB values into floating point RGB values.
 * Example: #FF0000 -> [1.0, 0.0, 0.0]
 *
 * Reference: http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
 */
function hexToRgb(hex) {
    hex = (hex.indexOf('#') === 0) ? hex.slice(1) : hex;
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;

    return [r / 255, g / 255, b / 255];
}

// Polyfill for Array.indexOf
[].indexOf||(Array.prototype.indexOf=function(a,b,c){for(c=this.length,b=(c+~~b)%c;b<c&&(!(b in this)||this[b]!==a);b++);return b^c?b:-1;});

// Polyfill for performance API
(function () {
    window.performance = window.performance || {};
    window.performance.now = window.performance.now || window.performance.webkitNow ||
                            window.performance.msNow || window.performance.mozNow ||
                            Date.now || function () { return new Date().getTime(); };
})();