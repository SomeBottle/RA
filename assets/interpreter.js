/* 关系代数解释器 */
'use strict';
const interpreter = {
    understand: function (statements) { // 解释语句
        /* 括号层次分析，下面展示一下储存结构
            (       (        (       )        (         )           )       )     ←假如这些括号中间没有空格
            ↑       ↑        ↑       ↑        ↑         ↑           ↑       ↑
          layer0 layer1    layer2  layer2   layer2    layer2       layer1  layer0   ←括号层次
           [0]     [1]      [2]    [2,3]  [2,3],[4]  [2,3],[4,5]   [1,6]    [0,7]   ←每个层次每个括号的[起始左括号下标,结束右括号下标]
        */
        let layers = [], // 括号层次
            depth = 0, // 当前括号层次
            bv = basicView;
        for (let i = 0, len = statements.length; i < len; i++) { // 遍历语句
            if (!layers[depth]) layers[depth] = []; // 如果没有就初始化当前括号层次
            let chr = statements[i];// 当前字符
            if (chr === '(') { // 如果是左括号
                let layer = layers[depth], // 当前操作的层次
                    newIndex = layer.length; // 当前操作层中当前括号的数组索引
                layer[newIndex] = [i]; // 初始化当前括号
                depth += 1; // 在操作完后再加一层，这样下标是从0开始
            } else if (chr === ')') { // 如果是右括号，当前层的当前括号闭合
                depth -= 1; // 这里要等层次升高后再操作
                let layer = layers[depth], // 当前操作的层次
                    prevIndex = layer.length - 1; // 当前操作层中当前括号的数组索引
                layer[prevIndex].push(i); // 当前括号闭合
            }
        }
        if (depth > 0) throw `${bv.getLang('interpreter > syntaxError.parenthesisRight')}. Pos:${i}`; // 括号未闭合错误
        layers = layers.slice(0, -1).reverse(); // 从低到高排列括号层次
        console.log(layers);
    }
};