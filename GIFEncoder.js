function set32Int2Array(array, begin, size, value, little_endian=true){
    let u32 = new Uint32Array(1);
    u32[0] = parseInt(value);
    let target = new array.constructor(u32.buffer);
    let actual_size = 0;
    for(let i of target){
        if(i > 0){
            actual_size++;
        }
    }
    if(actual_size > size){
        console.warn(`${value} to ${array} with ${size} will lose`);
    }
    let k = 0;
    if(little_endian){
        for(let i=begin; i < begin+size; i++){
            array[i] = target[k++];
        }
    }else{
        for(let i=begin+size-1; i >= begin; i--){
            array[i] = target[k++];
        }
    }
    
    return array;
}

/**
 * flexible code sizes array with data-sub block feature
 */
class FlexSizeByteArray{
    constructor(){
        this.bytes_array = [0];
        this.left_size = 0;
        this.sub_block_size = 0;
        this.sub_block_size_position = 0;
        this.mask = (1 << 8) - 1; // 0xff
    }

    add(value, size){
        if(this.left_size == 0){
            this.bytes_array.push(0);
            this.left_size = 8;
            this.sub_block_size += 1;
            if(this.sub_block_size == 256){
                this.bytes_array[this.sub_block_size_position] = 255;
                this.bytes_array.push(0);
                this.sub_block_size_position = this.bytes_array.length - 2;
                this.sub_block_size = 1;
            }
            return this.add(value, size);
        }
        if(this.left_size >= size){
            value = value << (8 - this.left_size);
            value &= this.mask;
            this.bytes_array[this.bytes_array.length-1] |= value;
            this.left_size -= size;
            return;
        } else {
            let left = value >> this.left_size;
            let left_size = size - this.left_size;
            this.add(value, this.left_size);
            return this.add(left, left_size);
        }
    }

    toArray(prefix=[], suffix=[]){
        this.bytes_array[this.sub_block_size_position] = this.sub_block_size;
        this.bytes_array.push(0);
        return new Uint8Array(prefix.concat(this.bytes_array).concat(suffix));
    }
}

class LZWEncoder{
    constructor(min_code_size, color_count){
        this.min_code_size = min_code_size;
        if(min_code_size > 8){
            throw new Error(`Illegal min_code_size: ${min_code_size}, must be less than 9`);
        }
        if(min_code_size < 2){
            console.warn("min_code_size less than 2, auto assign to 2");
            this.min_code_size = 2;
        }
        this.color_count = color_count;
        let table_size = (1 << min_code_size) - 1;
        this.clear_code = table_size + 1;
        this.end_of_infomation_code = this.clear_code + 1;
        this.initialCodeTable();
    }

    initialCodeTable(){
        this.code_table = {};
        this.code_index = this.end_of_infomation_code;
        for(let i=0; i < this.color_count; i++){
            this.code_table[i] = i;
        }
    }

    encode(indices){
        let code_bits = this.min_code_size + 1;
        let code_stream = new FlexSizeByteArray();

        code_stream.add(this.clear_code, code_bits);

        let index_buffer=indices[0];
        for(let k=1; k <= indices.length; k++){
            let cur = [index_buffer, indices[k]].join(',');
            if(this.code_table[cur]){
                index_buffer = cur;
            }else{
                // put new code into table
                this.code_table[cur] = ++this.code_index;

                // console.log(this.code_table[index_buffer]);
                
                code_stream.add(this.code_table[index_buffer], code_bits);

                index_buffer = indices[k];

                // increase the code size when index exceed the code size maximum
                if(this.code_index == (1 << code_bits)){
                    code_bits++;
                    if(code_bits > 12){
                        code_bits = this.min_code_size + 1;
                        code_stream.add(this.clear_code, code_bits);
                        this.initialCodeTable();
                    }
                }
            }
        }
        code_stream.add(this.end_of_infomation_code, code_bits);
        return code_stream.toArray([this.min_code_size]);
    }
};

class GIF{
    /**
     * 
     * @param {uint} screen_width 
     * @param {uint} screen_height 
     * @param {Array} background_color RGB color for background
     */
    constructor(screen_width, screen_height, background_color=[0,0,0]){
        this.background_color = background_color;
        this.header = new Uint8Array(6);
        this.header[0] = 'G'.charCodeAt(0);
        this.header[1] = 'I'.charCodeAt(0);
        this.header[2] = 'F'.charCodeAt(0);
        this.header[3] = '8'.charCodeAt(0);
        this.header[4] = '9'.charCodeAt(0);
        this.header[5] = 'a'.charCodeAt(0);
        this.gifDataStream = null;
        this.gct = null;
        this.screen_width = screen_width;
        this.screen_height = screen_height;
        this.frames = [];
    }

    /**
     * set LogicalScreenDescriptor by Class Attribute
     */
    setDataStream(){
        this.gifDataStream = new Uint8Array(7);
        set32Int2Array(this.gifDataStream, 0,2, this.screen_width);
        set32Int2Array(this.gifDataStream, 2,2, this.screen_height);
        let b = 0;
        if(this.gct_flag){
            b |= 128;
        }
        if(this.color_resolution > 7){
            this.color_resolution = 7;
        }
        b |= this.color_resolution << 4;
        if(this.sort_flag){
            b |= 8;
        }
        if(this.gct_size > 7){
            this.gct_size = 7;
        }
        b |= this.gct_size;
        set32Int2Array(this.gifDataStream, 4,1, b);
        set32Int2Array(this.gifDataStream, 5,1, this.background_color);
        set32Int2Array(this.gifDataStream, 6,1, this.pixel_aspect_ratio);
    }

    /**
     * 
     * @param {Array} colors must be like
     * [
     *   [R,G,B],
     *   [R,G,B],
     *   ...
     * ]
     */
    setGolbalColorTable(colors){
        this.gct = new Uint8Array(colors.length*3);
        for(let i=0; i < colors.length; i++){
            this.gct[i*3] = colors[i][0];
            this.gct[i*3+1] = colors[i][1];
            this.gct[i*3+2] = colors[i][2];
        }
    }

    setApplicationExtension(){
        this.ape = new Uint8Array(19);
        set32Int2Array(this.ape, 0, 1, 33); // GIF Extension Code
        set32Int2Array(this.ape, 1, 1, 255); // Application Extension Label
        set32Int2Array(this.ape, 2, 1, 11); // Length of Application Block
        set32Int2Array(this.ape, 3, 4,  1313166419, false); // NETS
        set32Int2Array(this.ape, 7, 4,  1128353861, false); // CAPE
        set32Int2Array(this.ape, 11, 3,  3288624, false); // 2.0
        set32Int2Array(this.ape, 14, 1,  3); // Sub-Block Length
        set32Int2Array(this.ape, 15, 1,  1); // fixed 1
        set32Int2Array(this.ape, 16, 2,  this.loop_count);
        // terminator always 0
    }

    /**
     * 
     * @param {uint} delay_time  hundredths of a second 
     */
    getGraphicControl(delay_time){
        let graphic_control = new Uint8Array(8);
        set32Int2Array(graphic_control, 0, 1, 33);
        set32Int2Array(graphic_control, 1, 1, 249);
        set32Int2Array(graphic_control, 2, 1, 4);
        set32Int2Array(graphic_control, 3, 1, 8); // Packed Field disposal method 2 restore to backgroud every image
        set32Int2Array(graphic_control, 4, 2, delay_time);
        // Packed Field 0 mean Transparent disabled, transparent color index useless
        // block terminator always 0
        return graphic_control;
    }

    getImageDescriptor(){
        let image_descriptor = new Uint8Array(10);
        set32Int2Array(image_descriptor, 0, 1, 44);
        // position are  (0, 0)
        set32Int2Array(image_descriptor, 5, 2, this.screen_width);
        set32Int2Array(image_descriptor, 7, 2, this.screen_height);
        // local color table disabled, 0
        return image_descriptor;
    }

    /**
     * convert ImageData.data format to GIF.addFrame() needed
     * @param {Array} rgba rgba array like
     * [R1, G1, B1, A1, R2, G2, B2, A2, ...]
     * @param {Array} background rgb array for background color
     */
    RGBA2RBG(rgba, background){
        const MAX = 255;
        function f(a, c, b){
            a /= MAX;
            c /= MAX;
            b /= MAX;
            let out = ((1-a) * b) + (a * c);
            out *= MAX;
            return Math.round(out);
        }

        return [
            f(rgba[3], rgba[0], background[0]), 
            f(rgba[3], rgba[1], background[1]), 
            f(rgba[3], rgba[2], background[2])
        ];
    }

    /**
     * convert ImageData.data format to GIF.addFrame() needed
     * @param {Array} imageData rgba array
     * @return {Array} 3d array represent RGB on each pixel
     * @see addFrame()
     */
    parseImageData(imageData){
        let out = [];
        let i = 0;
        while(i < imageData.data.length){
            for(let x=0; x < imageData.height; ++x){
                let row = [];
                for(let y=0; y < imageData.width; ++y){
                    let pixel = this.RGBA2RBG([imageData.data[i], imageData.data[i+1], imageData.data[i+2], imageData.data[i+3]], [255,255,255]);
                    row.push(pixel);
                    i += 4;
                }
                out.push(row);
            }
        }
        return out;
    }

    /**
     * 
     * @param {list} frame 3d array represent RGB on each pixel or ImageData
     * [
     *      [[R,G,B], [R,G,B], ...],
     *      [[R,G,B], [R,G,B], ...],
     *      ...
     * ]
     * @param {uint} delay_time how long this frame last (hundredths of a second)
     */
    addFrame(frame, delay_time=0){
        if(frame instanceof ImageData){
            frame = this.parseImageData(frame);
        }
        this.frames.push({
            delay_time:delay_time,
            data:frame
        });
    }

    render(quality=7, loop_count=0){
        // get global color table
        let colors = [];
        let color_map = {};
        for(let frame of this.frames){
            for(let row of frame.data){
                for(let color of row){
                    if(color_map[""+color] === undefined){
                        color_map[""+color] = colors.length;
                        colors.push(color);
                    }
                }
            }
        }

        // put background color in map if not exist
        if(color_map[""+this.background_color] === undefined){
            color_map[""+this.background_color] = colors.length;
            colors.push(this.background_color);
        }

        // calculate the size of global color table
        let gcts = Math.ceil(Math.pow(colors.length, 0.5)) - 1;
        if(gcts < 1){
            gcts = 1;
        }
        // fill up the empty space in gct
        while(colors.length < Math.pow(2, gcts+1)){
            colors.push([0,0,0])
        }

        this.gct_flag = true;
        this.color_resolution = quality;
        this.sort_flag = false;
        this.gct_size = gcts;
        this.background_color = color_map[""+this.background_color];
        this.pixel_aspect_ratio = 0;
        this.setDataStream();

        this.setGolbalColorTable(colors);
        console.log("color table finished");

        this.loop_count = loop_count;
        this.setApplicationExtension();

        let image_datas = [];
        for(let frame of this.frames){
            let graphic_control = this.getGraphicControl(frame.delay_time);
            let image_descriptor = this.getImageDescriptor();
            let image_data = null;

            let lzw = new LZWEncoder(gcts+1, colors.length);
            let indices = [];
            for(let row of frame.data){
                for(let color of row){
                    indices.push(color_map[""+color]);
                }
            }
            image_data = lzw.encode(indices);
            image_datas.push([graphic_control, image_descriptor, image_data]);
        }
        console.log("image data finished");

        let out = [
            this.header,
            this.gifDataStream,
            this.gct,
            this.ape
        ];
        for(let frame of image_datas){
            for(let block of frame){
                out.push(new Uint8Array(block));
            }
        }
        out.push(new Uint8Array([59]));
        return new Blob(out, {type:"image/gif"});
    }

    /**
     * 
     * @param {Blob} blob Blob for GIF
     */
    async parse(blob){
        let arrayBuffer = await blob.arrayBuffer();
        this.header = this.parseHeader(arrayBuffer.slice(0, 6));
        this.parseLogicalScreenDescriptor(arrayBuffer.slice(6, 13));
        const gct_bytes_length = (Math.pow(2, this.gct_size+1)-1)*3;
        const color_table = this.parseColorTable(arrayBuffer.slice(13, 13+gct_bytes_length));
        let ae_begin = 13 + gct_bytes_length;
        this.parseApplicationExtension(arrayBuffer.slice(ae_begin, ae_begin+19));
        this.parseFrames(arrayBuffer.slice(ae_begin+19), color_table);
    }

    /**
     * 
     * @param {ArrayBuffer} arrayBuffer 
     */
    parseHeader(arrayBuffer){
        let header = new Uint8Array(arrayBuffer);
        if(header.length != 6){
            throw new Error("GIF Header invalid, too short");
        }
        let expected = "GIF89a";
        let equaled = true;
        for(let i=0; i < 6; ++i){
            if(header[i] !== expected.charCodeAt(i)){
                equaled = false;
                break;
            }
        }
        if(equaled){
            return header;
        }
        expected = "GIF87a";
        equaled = true;
        for(let i=0; i < 6; ++i){
            if(header[i] !== expected.charCodeAt(i)){
                equaled = false;
                break;
            }
        }
        if(equaled){
            return header;
        }
        throw new Error("GIF Header invalid, not 'GIF89a' or 'GIF87a'");
    }

    parseLogicalScreenDescriptor(arrayBuffer){
        let l = new Uint8Array(arrayBuffer);
        if(l.length != 7){
            throw new Error("GIF LogicalScreenDescriptor invalid, too short");
        }
        this.screen_width = (l[1] << 8) | l[0]; // little_endian
        this.screen_height = (l[3] << 8) | l[2]; // little_endian
        let packed_field = l[4];
        if(packed_field & 128 != 128){
            throw new Error("GIF LogicalScreenDescriptor invalid, Global Color Table not enable, this library only support Global Color Table not Local");
        }
        this.gct_flag = true;
        this.color_resolution = (packed_field & 112) >> 4;
        this.sort_flag = ((packed_field & 8) === 8);
        this.gct_size = packed_field & 7;
        this.background_color = l[5];
        this.pixel_aspect_ratio = l[6];
    }

    parseApplicationExtension(arrayBuffer){
        let l = new Uint8Array(arrayBuffer);
        if(l.length != 19){
            throw new Error("GIF ApplicationExtension invalid, too short");
        }
        let expected = "NETSCAPE2.0";
        let equaled = true;
        for(let i=0; i < expected.length; ++i){
            if(l[i+3] !== expected.charCodeAt(i)){
                equaled = false;
                break;
            }
        }
        if(!equaled){
            throw new Error("GIF ApplicationExtension invalid, not 'NETSCAPE2.0'");
        }
        this.loop_count = (l[17] << 8) | l[16];
    }

    parseColorTable(arrayBuffer){
        let l = new Uint8Array(arrayBuffer);
        if(l.length % 3 !== 0){
            throw new Error("Color Table length errer");
        }
        let color_table = [];
        for(let i=0; i < l.length; i+=3){
            color_table.push([
                l[i],
                l[i+1],
                l[i+2]
            ]);
        }
        return color_table;
    }

    parseFrames(arrayBuffer, color_table){
        let l = new Uint8Array(arrayBuffer);
        this.frames = [];
        while(l.length > 1){
            let delay_time = this.parseGraphicControl(l.slice(0, 8));
            // do not need ImageDescriptor right now, always full picture
            let index = 18;
            let fsbar = new FlexSizeByteArrayReader(l.slice(index));
            let lzw = new LZWDecoder(this.gct_size+1,  Math.pow(2, this.gct_size+1));
            let frame = [];
            let index_stream = lzw.decode(fsbar)
            for(let x=0; x < this.screen_height; ++x){
                let row = [];
                for(let y=0; y < this.screen_width; ++y){
                    let i = index_stream.shift();
                    if(!isNaN(i)){
                        row.push(color_table[i]);
                    } else {
                        throw new Error("not enough data, cannot fill a frame");
                    }
                }
                frame.push(row);
            }
            this.addFrame(frame, delay_time);
            l = l.slice(index + fsbar.index+1);
        }
        if(l[0] != 0x3B){
            throw new Error("GIF not finish correctly, or format not supported");
        }
    }

    /**
     * read delay_time from GraphicControl
     * @param {Uint8Array} l 
     * @return {Number} delay_time
     */
    parseGraphicControl(l){
        if(!(l[0] === 33 && l[1] === 249 && l[2] === 4 && (l[3] === 8)||l[3]===0)){
            throw new Error("GIF GraphicControl Invalid, not compatible GIF format");
        }
        return (l[5] << 8) | l[4];
    }

}