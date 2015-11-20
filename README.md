# node-ppmtool
nodejs ppm tools for decode and encode ppm

## Decoder

Decode `raw` and `plain text` ppm file.

```js
var fs = require("fs");
var ppmtool = require("ppmtool");

var decoder = new ppmtool.Decoder();

fs.readFile("/path/to/file.ppm", function(err, data) {
  decoder.raw = data;
  var image = decoder.decode();
  console.log(image.width, image.height, image.buffer);
});

```
Each pixel is described as a RGB triplet. 
The image decoded buffer has a length of `width*height*3`
