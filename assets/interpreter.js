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
    diver: function (arr, depth) { // 根据深度返回树的分支
        let pointer = arr;
        for (let i = 0; i < depth; i++) {
            let newInd = pointer.length,
                lastInd = newInd - 1,
                lastItem = pointer[lastInd];
            if (lastItem && lastItem instanceof Array) {
                pointer = lastItem;
            } else {
                pointer[newInd] = new Array();
                pointer = pointer[newInd];
            }
        }
        return pointer;
    },
    understand: function (statements) { // 解释语句
        let tree = [], // 语句树
            depth = 0,
            strBuffer = '',
            bufferer = (chr) => { // 将字符连成字符串
                if (!(/\s/).test(chr) && !['(', ')'].includes(chr)) {
                    strBuffer = strBuffer + chr;
                } else if (strBuffer) { // 一小段字符串连接完成
                    let branch = interpreter.diver(tree, depth);
                    branch.push(strBuffer);
                    strBuffer = '';
                }
            };
        for (let i = 0, len = statements.length; i < len; i++) {
            let chr = statements[i]; // 当前字符
            if (chr === '(') {
                bufferer(chr);
                depth++;
            } else if (chr === ')') {
                depth--;
                bufferer(chr);
            } else {
                bufferer(chr);
            }
        }
        console.log(tree);
    },
    findOperator: function (str) { // 寻找语句匹配的操作
        for (let i in this.operators) {
            let item = this.operators[i];
            for (let j = 0, len = item.length; j < len; j++) {
                if (item[j].test(str)) {
                    return i; // 返回操作符的key
                }
            }
        }
        return ''; // 匹配不到说明是关系或者非法语句，先暂留空字符串
    },
    operatorFuncs: { // 操作符对应的函数
        select: function (relation, expression) { // 选择
            console.log('select executed:', expression, relation);
            return relation;
        },
        project: function (relation, expression) { // 投影
            console.log('project executed:', expression, relation);
            return relation;
        }
    }
};
