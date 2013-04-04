precision mediump float;

attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
// attribute vec4 aVertexColor;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform highp mat4 uNormalMatrix;

varying highp vec3 vNormal;
varying highp vec3 vVertexPosition;
varying highp vec3 vOriginalNormal;

void main(void) {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    vNormal = (uNormalMatrix * vec4(aVertexNormal, 1.0) ).xyz;
    vVertexPosition = aVertexPosition;
}