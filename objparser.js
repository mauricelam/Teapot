/**
 * Parser for .obj files
 */

var objParser = {
    reset: function () {
        this.vertices = [];
        this.faces = [];
    },
    'v': function (x, y, z) { // vertex
        // vertex
        this.vertices.push(+x, +y, +z); // cast to number type
    },
    'f': function (v1, v2, v3) { // face
        v1 = v1.split('/')[0]; // only care about the vertex
        v2 = v2.split('/')[0];
        v3 = v3.split('/')[0];
        this.faces.push(+v1 - 1, +v2 - 1, +v3 - 1); // also convert 1-based indices to 0-based
    }, 
    'g': function () { /* group, ignore because I am not using it */ }, 
    '#': function () { /* it's a comment, just ignore */ },
    'vn': function () { /* vertex normals */ },
    'vt': function () { /* texture coords */ },
    's': function () { /* smoothing */ }
};

/**
 * Call this function to load a .obj file from a URL and then parse it into an object
 * 
 * @returns { vertices: <array of vertex coords>, faces: <array of vertex indices> }
 */
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

/**
 * Load a text file synchronously through XMLHttpRequest.
 */
function loadTextFile(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send();
    return request.responseText;
}

/**
 * Compute the per-vertex surface normals for the given set of vertices and faces. Vertices is the
 * same format as ARRAY_BUFFER, which x, y, z coordinates are laid out in the array next to each
 * other. Faces is a list of triangle vertex-indices, which indexes the vertices array.
 *
 * Example: computeNormals([0,0,0,1,1,1,2,2,2,3,3,3], [0,1,2,1,2,3])
 * computes the surface normals for the faces (0,0,0)(1,1,1)(2,2,2) and (1,1,1)(2,2,2)(3,3,3)
 * 
 * Note: The output normals are not normalized.
 */
function computeNormals (v, f) {
    var normals = new Float32Array(v.length);

    for (var i = 0, count = f.length; i < count; i += 3) {
        var v1 = f[i] * 3, v2 = f[i+1] * 3, v3 = f[i+2] * 3;
        var normal = getNormal(v[v1], v[v1+1], v[v1+2], v[v2], v[v2+1], v[v2+2], v[v3], v[v3+1], v[v3+2]);

        normals[v1] += normal[0];
        normals[v1+1] += normal[1];
        normals[v1+2] += normal[2];

        normals[v2] += normal[0];
        normals[v2+1] += normal[1];
        normals[v2+2] += normal[2];

        normals[v3] += normal[0];
        normals[v3+1] += normal[1];
        normals[v3+2] += normal[2];
    }
    return normals;
}

/**
 * Compute surface normal of the triangle defined by v1, v2, v3 in counter clockwise direction.s
 * Reference: http://www.opengl.org/wiki/Calculating_a_Surface_Normal
 */
function getNormal(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z) {
    var normal = new Float32Array(3);
    var Ux = v2x - v1x, Uy = v2y - v1y, Uz = v2z - v1z,
        Vx = v3x - v1x, Vy = v3y - v1y, Vz = v3z - v1z;
    normal[0] = Uy * Vz - Uz * Vy;
    normal[1] = Uz * Vx - Ux * Vz;
    normal[2] = Ux * Vy - Uy * Vx;
    return normal;
}