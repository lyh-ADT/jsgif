# jsgif
a simple gif library

## Background
I try to generate GIF from a html canvas, the library I found are not what I liked. So, I implemented one myself.

## Install
for current version, just link the [GIFEncoder.js](https://github.com/lyh-ADT/jsgif/blob/master/GIFEncoder.js) in your html file with the `<script>`


something like below, the `src` should be the path to `GIFEncoder.js` on your server.
```
<script src="GIFEncoder.js"></script>
```

## Usage
#### Encode
1. create a GIF instance
2. add frames into the instance by calling `addFrame()`
3. call `render()` get a Blob object of the GIF file
```
let gif = new GIF(10, 10);
gif.addFrame([
    two-dimension RGB matrix(0~255) or ImageData
]);
let b = gif.render();
```
![demo with two-dimension RGB matrix(0~255)](https://github.com/lyh-ADT/jsgif/blob/master/testings/GIF.html)

![demo with ImageData](https://github.com/lyh-ADT/jsgif/blob/master/testings/GIF-data-sub-block.html)

#### Decode
> Attension, the decode part of the library is not complele !!!  
> Only NETSCAPE2.0 standard tested  
> !!! Not support Plain Text Extension, Comment Extension, Local Color Table for current vesion  
> the GIF encode by this library can decode by this libray, of course 😝
1. create a GIF instance
2. parse a Blob object into the instance by calling `parse()`
3. do anything you want and call `render()` get a Blob object of the GIF file
```
let gif = new GIF(0,0);

let blob = new Blob([new Uint8Array([
    two-dimension RGB matrix(0~255)
])]);

gif.parse(blob).then(function(){
    document.getElementById("canvas").getContext("2d").putImageData(gif.getImageDataFrameAt(0), 0, 0);

    let b = gif.render();
});
```
[demo](https://github.com/lyh-ADT/jsgif/blob/master/testings/parse.html)

## License
[MIT](LICENSE) © lyh-ADT