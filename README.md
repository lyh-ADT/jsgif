# jsgif
a simple gif library

## Background
I try to generate GIF from a html canvas, the library I found are not what I liked. So, I implemented one myself.

## Install
for current version, just link the ![GIFEncoder.js](https://github.com/lyh-ADT/jsgif/blob/master/GIFEncoder.js) in your html file with the `<script>`


something like below, the `src` should be the path to `GIFEncoder.js` on your server.
```
<script src="GIFEncoder.js"></script>
```

## Usage
1. create a GIF instance
2. add frames into the instance by calling `addFrame()`
3. call `render()` get a Blob object of the GIF file
```
let gif = new GIF(10, 10);
gif.addFrame([
    two-dimension RGB matrix(0~255)
]);
let b = gif.render();
```
![demo](https://github.com/lyh-ADT/jsgif/blob/master/testings/GIF.html)

## License
[MIT](LICENSE) © lyh-ADT

## TODO
- decode part of the library
