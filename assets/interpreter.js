/* 关系代数解释器 */
'use strict';
const interpreter = {
    operators: { // 语法正则匹配
        'select': [/SELECT\{.+?\}/i, /选择\{.+?\}/, /σ\{.+?\}/], // 选择
        'project': [/PROJECT\{.+?\}/i, /投影\{.+?\}/, /π\{.+?\}/], // 投影
        'union': [/^UNION$/i, /^并$/, /^∪$/], // 并集
        'except': [/^EXCEPT$/i, /^减$/, /^-$/], // 差集
        'intersect': [/^INTERSECT$/i, /^交$/, /^∩$/], // 交集
        'crossjoin': [/^CROSSJOIN$/i, /^叉乘$/, /^×$/], // 外连接
        'dividedby': [/^DIVIDEDBY$/i, /^除$/, /^÷$/, /^\/$/], // 除法
        'outerjoin': [/^OJOIN$/i, /^外连接$/, /^⟗$/], // 外连接
        'leftjoin': [/^LJOIN$/i, /^左连接$/, /^⟕$/], // 左连接
        'rightjoin': [/^RJOIN$/i, /^右连接$/, /^⟖$/], // 右连接
        'thetajoin': [/^JOIN\{[\s\S]+?\}$/i, /^连接\{[\s\S]+?\}$/, /^⨝\{[\s\S]+?\}$/], // θ连接
        'naturaljoin': [/^JOIN$/i, /^自然连接$/, /^⨝$/] // 自然连接
    },
    oprtPriorities: { // 运算符优先级(数字越大越优先运算)
        'union': 1,
        'except': 1,
        'intersect': 1,
        'crossjoin': 1,
        'dividedby': 1,
        'outerjoin': 1,
        'leftjoin': 1,
        'rightjoin': 1,
        'thetajoin': 1,
        'naturaljoin': 1,
        'select': 2,
        'project': 2
    },
    understand: function (statements) { // 解释语句
        /* 括号层次分析，下面展示一下储存结构
            (       (        (       )        (         )           )       )     ←假如这些括号中间没有空格
            ↑       ↑        ↑       ↑        ↑         ↑           ↑       ↑
          layer0 layer1    layer2  layer2   layer2    layer2       layer1  layer0   ←括号层次
           0        0        0                1                                      ←每个层次每个左括号的起始下标
        */
        let layers = [], // 括号不同层次的起始下标
            strLayers = [],
            depth = 0, // 当前括号层次
            bv = basicView;
        statements = `(${statements})`; // 最外层用一个括号包起来以便解析
        for (let i = 0; i < statements.length; i++) {
            let chr = statements[i];// 当前字符
            layers[depth] = layers[depth] || []; // 如果没有就初始化当前括号层次
            strLayers[depth] = strLayers[depth] || [];
            if (chr === '(') { // 如果是左括号
                let layer = layers[depth]; // 当前操作的层次
                layer.push(i); // 记录当前层次d的左括号的起始下标
                depth += 1; // 在操作完后再加一层，这样下标是从0开始
            } else if (chr === ')') { // 如果是反括号，当前层的当前括号闭合
                depth -= 1; // 这里要等层次升高后再操作
                let layer = layers[depth], // 当前操作的层次
                    strLayer = strLayers[depth];
                if (!layer) break; // 括号未闭合会有下标溢出
                let startInd = layer.slice(-1)[0], // 当前反括号对应的左括号的起始下标
                    offset = i - startInd + 1; // 当前这一组括号内容的长度，用作后面切割的偏移
                strLayer.push(statements.slice(startInd, i + 1)); // 存入当前括号内容
                statements = statements.slice(0, startInd) + statements.slice(startInd + offset); // 在原语句中去除当前括号的内容
                i = i - offset;
            }
        }
        /*
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
                let layer = layers[depth]; // 当前操作的层次
                if (!layer) break; // 括号未闭合会有下标溢出
                let correIndex = layer.length - 1; // 对应(corresponding)操作层中对应括号的数组索引
                layer[correIndex].push(i); // 当前括号闭合
            }
        }
        */
        if (depth !== 0) throw bv.getLang('interpreter > syntaxError.parenthesisLeft'); // 括号未闭合错误
        strLayers = strLayers.slice(0, -1).reverse(); // （原数组最后会多出来一个值，用slice去掉）
        let parentheses = /^(\(|\))+?$/, //全都是括号的情况
            results = []; // 运算结果
        for (let i = 0, len = strLayers.length; i < len; i++) {
            let strLayer = strLayers[i],
                operations = []; // 当前层的操作指令
            strLayer.forEach(thesis => {
                let spaced = thesis.split(/\s/).filter(x => x && x.trim() && !x.match(parentheses)); // 去除多余空格和纯括号
                for (let j = 0, len = spaced.length; j < len; j++) {
                    operations.push(this.findOperator(spaced[j])); // 遍历操作符
                }
            });
            for (let x = 0, len = operations.length; x < len; x++) { // 遍历本层指令
                let oprt = operations[x];
                if (!oprt) { // 没有找到对应的操作符
                    let relation=strLayer[x].slice(1,-1); // 获得指令对应的关系名
                }
            }
            console.log(operations, 'layer:', i);
        }
        console.log(strLayers);
    },
    findOperator(str) { // 寻找语句匹配的操作
        for (let i in this.operators) {
            let item = this.operators[i];
            for (let j = 0, len = item.length; j < len; j++) {
                if (item[j].test(str)) {
                    return i; // 返回操作符的key
                }
            }
        }
        return ''; // 匹配不到说明是关系或者非法语句，先暂留空字符串
    }
};
