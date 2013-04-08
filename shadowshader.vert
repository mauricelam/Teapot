precision mediump float;

attribute vec3 aPosition;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec3 vVertexPosition;

void main(void) {
    gl_Position = uPMatrix * uMVMatrix * vec4(aPosition, 1.0);
    vVertexPosition = aPosition;
}