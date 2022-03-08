/* 关系代数解释器 */
'use strict';
const interpreter = {
    operators: { // 语法正则匹配
        'select': [/^SELECT\{([\s\S]+?)\}$/i, /^选择\{([\s\S]+?)\}$/, /^σ\{([\s\S]+?)\}$/], // 选择
        'project': [/^PROJECT\{(.+?)\}$/i, /^投影\{(.+?)\}$/, /^π\{(.+?)\}$/], // 投影
        'union': [/^UNION$/i, /^并$/, /^∪$/], // 并集
        'except': [/^EXCEPT$/i, /^减$/, /^-$/], // 差集
        'intersect': [/^INTERSECT$/i, /^交$/, /^∩$/], // 交集
        'crossjoin': [/^CROSSJOIN$/i, /^叉乘$/, /^×$/], // 外连接
        'dividedby': [/^DIVIDEDBY$/i, /^除$/, /^÷$/, /^\/$/], // 除法
        'outerjoin': [/^OJOIN$/i, /^外连接$/, /^⟗$/], // 外连接
        'leftjoin': [/^LJOIN$/i, /^左连接$/, /^⟕$/], // 左连接
        'rightjoin': [/^RJOIN$/i, /^右连接$/, /^⟖$/], // 右连接
        'thetajoin': [/^JOIN\{([\s\S]+?)\}$/i, /^连接\{([\s\S]+?)\}$/, /^⨝\{([\s\S]+?)\}$/], // θ连接
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
            bv = basicView,
            bufferer = (chr) => { // 将字符连成字符串
                if (!(/\s/).test(chr) && !['(', ')'].includes(chr)) {
                    strBuffer = strBuffer + chr;
                } else if (strBuffer) { // 一小段字符串连接完成
                    let branch = this.diver(tree, depth);
                    branch.push(strBuffer); // 把指令推入树分支，树形化
                    strBuffer = '';
                }
            };
        for (let i = 0, len = statements.length; i < len; i++) {
            let chr = statements[i]; // 当前字符
            bufferer(chr); // 就放在此处，在处理深度之前处理字符
            if (chr === '(') {
                depth++;
            } else if (chr === ')') {
                depth--;
            }
        }
        if (depth !== 0) throw bv.getLang('interpreter > syntaxError.parenthesisLeft'); // 括号未闭合错误
        console.log(tree);
    },
    findOperator: function (str) { // 寻找语句匹配的操作
        for (let i in this.operators) {
            let item = this.operators[i];
            for (let j = 0, len = item.length; j < len; j++) {
                let matching = str.match(item[j]);
                if (matching) {
                    return [i, matching[1] || '']; // [操作符,{}中的表达式]
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
