precision mediump float;

varying highp vec3 vNormal;
varying highp vec3 vVertexPosition;

uniform vec2 uRotations;
uniform sampler2D uReflectionSampler;
uniform sampler2D uTextureSampler;
uniform sampler2D uBumpMapSampler;

uniform float uMaxBrightness;
uniform float uAverageBrightness;
uniform vec3 uLightVector;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

uniform float uShininess;

float blackness(vec4 color) {
    return (3.0 - color.r - color.g - color.b) * color.a * 0.33;
}

vec3 bump(sampler2D bumpSampler, vec2 coord, vec3 sDirection, vec3 tDirection) {
    vec2 dx = vec2(1.0 / 512.0, 0.0);
    vec2 dy = vec2(0.0, 1.0 / 512.0);
    float color = blackness(texture2D(bumpSampler, coord));
    float x = (blackness(texture2D(bumpSampler, coord + dx)) - color);
    float y = (blackness(texture2D(bumpSampler, coord + dy)) - color);

    return x * sDirection + y * tDirection;
}

const float PI = 3.14159265358979323846264;
const float degtorad = 0.0174532925;

vec2 equirectangular(vec2 thetaPhi) {
    float s = thetaPhi[0] * 0.5 / PI;
    float t = thetaPhi[1] / PI + 0.5;

    t = mod(t + 1.0, 2.0) - 1.0;
    float flip = step(-t, 0.0); // whether to flip the s coordinates
    t = abs(t);

    s = s + flip * 0.5;
    s = mod(s, 1.0);

    return vec2(s, t);
}

vec2 equirectangular(vec3 vector) {
    vector = normalize(vector);
    float theta = atan(vector.z, vector.x);
    float phi = asin(-vector.y);
    return equirectangular(vec2(theta, phi));
}

mat3 transpose(mat3 matrix) {
    mat3 result = mat3(matrix);
    result[0][1] = matrix[1][0];
    result[1][0] = matrix[0][1];
    result[0][2] = matrix[2][0];
    result[2][0] = matrix[0][2];
    result[1][2] = matrix[2][1];
    result[2][1] = matrix[1][2];
    return result;
}

/**
 * Main Function
 */

void main(void) {
    // Some useful attributes
    vec2 textureCoord = vec2(
        vVertexPosition.x, 
        vVertexPosition.z
    ) * 0.0000000001;
    // derivatives of the textureCoord functions
    vec3 sDirection = vec3(1.0, 0.0, 0.0);
    vec3 tDirection = vec3(0.0, 0.0, 1.0); 

    vec4 viewVector = uPMatrix * uMVMatrix * vec4(-vVertexPosition, 1.0);
    vec3 view = normalize(viewVector.xyz / viewVector.w);
    vec3 bump = bump(uBumpMapSampler, textureCoord, sDirection, tDirection) * 2.0;
    vec3 normal = normalize(vNormal.xyz + bump);

    // The rotation done by dragging
    // We need this to calculate the changes done to the environment
    float cy = cos(uRotations.x * degtorad);
    float sy = sin(-uRotations.x * degtorad);
    mat3 yawRotation = mat3(cy, 0.0, sy, 0.0, 1.0, 0.0, -sy, 0.0, cy);
    float cp = cos(uRotations.y * degtorad);
    float sp = sin(-uRotations.y * degtorad);
    mat3 pitchRotation = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp);

    mat3 rotationMatrix = pitchRotation * yawRotation;
    mat3 rotationInverse = transpose(rotationMatrix);

    // Lighting
    vec3 lightVector = normalize(rotationMatrix * uLightVector);
    vec3 ambientLight = vec3(0.5) * uAverageBrightness;
    vec3 diffuseColor = vec3(1.0, 1.0, 0.9) * uAverageBrightness * 1.5;
    vec3 specularColor = vec3(1.0, 1.0, 0.9) * uMaxBrightness * 0.2;

    float ndotl = dot(normal, lightVector);
    float diffuse = max(ndotl, 0.0);

    vec3 r = (2.0 * ndotl * normal) - lightVector;
    float vdotr = dot(view, r);
    float specular = max(pow(vdotr, 5.0), 0.0);

    vec3 lighting = ambientLight + (diffuseColor * diffuse) + (specularColor * specular);

    // Reflection mapping
    vec3 reflectDirection = reflect(view, normal);
    reflectDirection = rotationInverse * reflectDirection;
    vec4 reflection = texture2D(uReflectionSampler, equirectangular(reflectDirection));

    vec4 texture = texture2D(uTextureSampler, textureCoord);

    // Add some noise
    vec4 color = texture * vec4(lighting, 1.0) * (reflection * 0.5 + 0.5);
    gl_FragColor = color;
    // gl_FragColor = vec4(lightVector, 1.0); // just for debugging
}