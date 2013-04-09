precision mediump float;

varying vec3 vNormal, vVertexPosition;

uniform vec2 uRotations;
uniform sampler2D sReflection, sTexture, sBumpMap, sShadowMap;

uniform float uMaxBrightness, uAverageBrightness;
uniform vec3 uLightVector;

uniform mat4 uMVMatrix, uPMatrix;
uniform mat4 uLightView, uLightProj;

uniform float uShininess, uSmoothness, uTextureAlpha, uBumpMapDepth, uShadowDepth;
uniform vec3 uColor;

const float PI = 3.14159265358979323846264;
const float degtorad = 0.0174532925;

float blackness(vec4 color) {
    return (3.0 - color.r - color.g - color.b) * color.a * 0.33;
}

// Returns the bump gradient, along the specified u and v directions, from the bump map
vec3 bump(sampler2D bumpSampler, vec2 coord, vec3 uDirection, vec3 vDirection) {
    vec2 dx = vec2(1.0 / 256.0, 0.0);
    vec2 dy = vec2(0.0, 1.0 / 256.0);
    float color = blackness(texture2D(bumpSampler, coord));
    float x = (blackness(texture2D(bumpSampler, coord + dx)) - color);
    float y = (blackness(texture2D(bumpSampler, coord + dy)) - color);

    return x * uDirection + y * vDirection;
}

/**
 * Calculates the equirectanglar projection from the spherical coordinates theta and phi values.
 * The spherical coordinates mirrors the latitude (phi) and longitude (theta) system, instead of
 * those commonly used in mathematics or physics.
 * 
 * Theta is the angle along the xz-plane from the -x-axis counterclockwise.
 *     0 = -x-axis, PI/2 = -z-axis, PI = +x-axis, etc.
 * Phi is the angle from the xz-plane up to the +y-axis.
 *     -PI/2 = -y-axis, 0 = equator, PI/2 = +y-axis, etc. (assuming theta is 0)
 */
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

/**
 * Calculates the equirectangular projection from a vector in Cartesian coordinates.
 */
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
 * For shadow mapping, to reduce light leaking.
 */
float linstep(float low, float high, float v) {
    return clamp((v-low)/(high-low), 0.0, 1.0);
}

/**
 * For shadow mapping.
 * Reference: http://codeflow.org/entries/2013/feb/15/soft-shadow-mapping/
 */
float VSM(sampler2D depths, vec2 uv, float compare) {
    vec2 moments = texture2D(depths, uv).xy;
    float p = smoothstep(compare-0.02, compare+0.002, moments.x);
    float variance = max(moments.y - moments.x*moments.x, 0.003);
    float d = compare - moments.x;
    float p_max = linstep(0.05, 0.8, variance / (variance + d*d));
    return clamp(max(p, p_max), 0.0, 1.0);
}

/**
 * Main Function
 */
void main(void) {
    // Some useful attributes
    vec2 textureCoord = vec2(
        atan(-vVertexPosition.z, vVertexPosition.x), 
        vVertexPosition.y
    ) * 0.35 + vec2(0.1, 0.1);
    // derivatives of the textureCoord functions
    vec3 sDirection = vec3(-sin(textureCoord.s), 0.0, cos(textureCoord.s));
    vec3 tDirection = vec3(0.0, 1.0, 0.0); 

    vec4 viewVector = uPMatrix * uMVMatrix * vec4(-vVertexPosition, 1.0);
    vec3 view = normalize(viewVector.xyz / viewVector.w);
    vec3 bumpVal = bump(sBumpMap, textureCoord, sDirection, tDirection) * uBumpMapDepth;
    vec3 normal = normalize(vNormal.xyz + bumpVal);

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
    vec3 ambientLight = vec3(0.3);
    vec3 diffuseColor = vec3(1.0, 1.0, 0.9) * uAverageBrightness;
    vec3 specularColor = vec3(1.0, 1.0, 0.9) * uMaxBrightness * 0.5;

    float ndotl = dot(normal, lightVector);
    float diffuse = max(ndotl, 0.0);

    vec3 r = (2.0 * ndotl * normal) - lightVector;
    float vdotr = dot(view, r);
    float specular = max(pow(vdotr, 5.0), 0.0);

    vec3 lighting = ambientLight + (diffuseColor * diffuse) + (specularColor * specular);

    // Reflection mapping
    vec3 reflectDirection = reflect(view, normal);
    reflectDirection = rotationInverse * reflectDirection;
    vec4 reflection = texture2D(sReflection, equirectangular(reflectDirection));

    vec4 texture = texture2D(sTexture, textureCoord);

    // Shadow mapping
    vec4 lightPos = uLightView * vec4(vVertexPosition, 1.0);
    vec4 lightProjPos = uLightProj * vec4(lightPos.xyz, 1.0);
    vec2 lightDeviceNormal = lightProjPos.xy / lightProjPos.w;
    vec2 lightUV = lightDeviceNormal * 0.5 + 0.5;
    float fragDepth = clamp(length(lightProjPos)/7.0, 0.0, 1.0);
    float illuminated = VSM(sShadowMap, lightUV, fragDepth);

    lighting = lighting * (illuminated * uShadowDepth + 1.0 - uShadowDepth);

    float textureAlpha = uTextureAlpha * texture.a;
    vec4 surfaceColor = texture * textureAlpha + vec4(uColor, 1.0) * (1.0 - textureAlpha);
    vec4 color = surfaceColor * vec4(lighting, 1.0) * (reflection * uShininess + (1.0 - uShininess));
    gl_FragColor = color;
    // gl_FragColor = vec4(light, 1.0); // just for debugging
}