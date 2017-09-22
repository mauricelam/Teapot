--------------------------
WebGL Teapot
--------------------------

It's the Utah teapot, stretched back to about its original height. With textures, shadows, bump maps and all the awesomeness. 

Javascript code, in rough order of importance
- main.js : the entry point of the code. Glues every part together
- teapot.js : code for drawing teapot and maintaining its states
- streetview.js : code for drawing the panorama and maintaining its states
- pipeline.js : implementation of the perspective - modelview matrix pipeline, plus other boilerplates
- objparser.js : parser for wavefront .obj files
- utils.js : simple library functions

Shaders

| Object      | Shaders           |
| ----------- | ----------------- |
| Teapot      | potshader.frag    |
|             | potshader.vert    |
| Panorama    | panoshader.frag   |
|             | panoshader.vert   |
| Shadow      | shadowshader.frag |
|             | shadowshader.vert |

Features
- Phong lighting with dynamic light intensities based on environment brightness
- Texture mapping
- Environment mapping on Street view or Google+ photospheres
- Bump mapping
- Real-time shadow mapping
- Changable colors
- Drag and drop texture and bump map changing (can add arbitrary image URLs)
- Customizable shadow intensities, bump map depth and environment blur

Interactions
- Drag to rotate camera, like you would in street view
- Press spacebar to stop / resume rotation of teapot
- Press + / - to go towards / away from the teapot

Compile instructions: Start a server at the project directory, for example
                        `python -m SimpleHTTPServer`
        http://mauricelam.github.io/Teapot
Note: just opening index.html won't work because of cross-domain security problems.

