precision mediump float;

attribute vec3 aVertexPosition, aVertexNormal;
uniform mat4 uMVMatrix, uPMatrix, uNormalMatrix;

varying highp vec3 vNormal;
varying highp vec3 vVertexPosition;

void main(void) {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    vNormal = ( uNormalMatrix * vec4(aVertexNormal, 1.0) ).xyz;
    vVertexPosition = aVertexPosition;
}