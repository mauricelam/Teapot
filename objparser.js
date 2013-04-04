var objParser = {
    reset: function () {
        this.vertices = [];
        this.faces = [];
    },
    'v': function (x, y, z) {
        // vertex
        this.vertices.push(+x, +y, +z); // cast to number type
    },
    'vt': function (x, y, z) {
        // texture coords (ignore for now)
    },
    'f': function (v1, v2, v3) {
        // face
        v1 = v1.split('/')[0];
        v2 = v2.split('/')[0];
        v3 = v3.split('/')[0];
        this.faces.push(+v1 - 1, +v2 - 1, +v3 - 1); // also convert 1-based indices to 0-based
    }, 
    'g': function () {
        // it's a group, and I am just ignoring it because I am not going to use it. 
    }, 
    '#': function () {
        // it's a comment, just ignore
    },
    'vn': function () {},
    's': function () {}
};

function loadObjFile (url) {
    var objString = loadTextFile(url);
    var lines = objString.split('\n');
    objParser.reset();

    lines.forEach(function (line) {
        if (line.length === 0) { return; }
        var components = line.split(/ +/);
        var type = components[0];
        try {
            objParser[type].apply(objParser, components.slice(1));
        } catch (e) {
            console.warn('Unknown obj command type: "' + type + '"', e.toString());
        }
    });

    return { vertices: objParser.vertices, faces: objParser.faces };
}

function loadTextFile(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send();
    return request.responseText;
}