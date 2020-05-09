class FlexSizeByteArrayReader{
    constructor(array){
        this.array = array;
        this.reset();
    }

    reset(){
        this.index = 0;
        this.left_size = 8;
        this.read_value = 0;
        this.read_size = 0;
        this.sub_block_size = 1;
    }

    read(size){
        if(this.left_size === 0){
            this.index++;
            this.sub_block_size--;
            if(this.index >= this.array.length){
                throw new Error("not enough data");
            }
            this.left_size = 8;
            if(this.sub_block_size === 0){
                this.sub_block_size = this.read(8) + 1;
                return this.read(size);
            }
        }
        if(this.left_size >= size){
            let mask = (1 << size) - 1;
            this.read_value |= (this.array[this.index] & mask) << this.read_size;
            this.left_size -= size;
            this.array[this.index] >>= size;
            let out = this.read_value;
            this.read_value = 0;
            this.read_size = 0;
            return out;
        } else {
            let mask = ((1 << this.left_size) - 1);
            this.read_value = (this.array[this.index] & mask);
            let left_size = this.left_size;
            this.read_size += left_size;
            this.array[this.index] = 0;
            this.left_size = 0;
            return this.read(size - left_size);
        }
    }
}

class LZWDecoder{
    constructor(min_code_size, color_count, color_table=null){
        this.min_code_size = min_code_size;
        this.color_count = color_count;
        this.color_table = color_table;
        this.code_table = {};
        let table_size = (1 << min_code_size) - 1;
        this.clear_code = table_size + 1;
        this.end_of_infomation_code = this.clear_code + 1;
        this.initialCodeTable();
    }

    initialCodeTable(){
        this.code_table = {};
        this.code_table = {};
        this.code_index = this.end_of_infomation_code;
        for(let i=0; i < this.color_count; i++){
            this.code_table[i] = i;
        }
    }

    /**
     * 
     * @param {FlexSizeByteArrayReader} code_stream 
     */
    decode(code_stream){
        let code_size = code_stream.read(8) + 1; // min_code_size
        code_stream.read(code_size); // clear code
        let c = code_stream.read(code_size);
        let index_stream = [this.code_table[c]];
        let k = 0;
        let old = c;
        while((c = code_stream.read(code_size)) !== this.end_of_infomation_code){
            if(c === this.clear_code){
                this.initialCodeTable();
                continue;
            }
            if(this.code_table[c] === undefined){
                k = (''+this.code_table[old])[0];
                let out = [this.code_table[old],k].join(',');

                index_stream = index_stream.concat(out.split(',').map(i => parseInt(i)));
                this.code_table[++this.code_index] = out;
            } else {
                index_stream = index_stream.concat((''+this.code_table[c]).split(',').map(i => parseInt(i)));
                k = (''+this.code_table[c])[0];
                this.code_table[++this.code_index] = [this.code_table[old],k].join(',');
            }
            if(this.code_index + 1 === (1 << code_size)){
                code_size++;
            }
            old = c;
        }
        code_stream.index++;
        if(code_stream.array[code_stream.index] !== 0){
            throw new Error("Image Data Block not finish correctly, Data might be damaged");
        }
        return index_stream;
    }
}