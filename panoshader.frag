precision mediump float;

varying highp vec3 vVertexPosition;
varying highp vec2 vTextureCoord;
uniform sampler2D uSampler;

void main (void) {
    // Texture coords inverted when viewed from inside the sphere
    vec4 texture = texture2D(uSampler, vec2(1.0-vTextureCoord.s, 1.0-vTextureCoord.t));
    gl_FragColor = texture;
}