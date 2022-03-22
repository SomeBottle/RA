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
    oprtTypes: { // 运算符类型（一目和二目运算）
        'union': 2,
        'except': 2,
        'intersect': 2,
        'crossjoin': 2,
        'dividedby': 2,
        'outerjoin': 2,
        'leftjoin': 2,
        'rightjoin': 2,
        'thetajoin': 2,
        'naturaljoin': 2,
        'select': 1,
        'project': 1
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
    understand: function (statements) { // 简单树形化语句
        let tree = [], // 语句树
            depth = 0,
            strBuffer = '',
            bv = basicView,
            bufferer = (chr) => { // 将字符连成字符串
                // 没有遇到空字符或者括号就算同一节字符串
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
        console.log(this.branchParser(tree)); // 解析树语句
    },
    flattenTree: function (tree) { // 分析语句，最后输出结果只剩一层
        let treeLen = tree.length,
            bv = basicView,
            result = []; // 每一项为[操作类型,值,原项目]
        for (let i = 0; i < treeLen; i++) {
            let item = tree[i];
            if (item instanceof Array) { // 如果是数组，就相当于括号，则递归
                result.push(['child', this.branchParser(item), item]); // child的值就是关系
            } else {
                let oprt = this.findOperator(item); // 找到操作符
                if (!oprt) {
                    let relation = relaObj.x(item).base;
                    if (relation) { // 如果是关系
                        result.push(['relation', relation, item]);
                    } else {
                        throw `${bv.getLang('interpreter > referenceError.notDefined')}: ${item}`; // 找不到关系的错误
                    }
                } else { // 操作符有效
                    result.push(['operator', oprt, item]);
                }
            }
        }
        return result;
    },
    branchParser: function (branch) { // 分析树分支
        let flatted = this.flattenTree(branch), // 展平树（将括号内的子语句运算完成）
            branchLen = flatted.length,
            bv = basicView,
            result = [];
        for (let i = 0; i < branchLen; i++) {
            // [类型(操作符operator,子关系child,关系relation),值,原语句]
            let [type, value, origin] = flatted[i];
            if (type === 'operator') {
                let [oprt, logic] = value, // [操作符,逻辑表达式]
                    [prevType, prevValue] = flatted[i - 1] || [], // 前一项，二元运算需要用到
                    prevItemUsable = ['child', 'relation'].includes(prevType), // 前一项是否可用(二目运算要用)
                    [nextType, nextValue] = flatted[i + 1] || [[], []], // 获得下一项，这一项无论一元还是二元，都是需要的
                    [nextZero, nextLogic] = nextValue, // 下一项数组的0位，可能是操作符，也可能是运算好的关系（考虑到下一项可能是一目运算）
                    nextItemUsable = ['child', 'relation'].includes(nextType), // 下一项是否作为关系可用
                    nextIsOprt = this.oprtTypes[nextZero] === 1, // （考虑到下一项可能是一目运算）
                    oprtType = this.oprtTypes[oprt], // 操作符是一目还是二目
                    probableRela = relaObj.x(origin).base, // 可能是关系
                    oprtFunc = this.operatorFuncs[oprt]; // 操作符的函数
                if (oprtType === 2 && prevItemUsable && (nextItemUsable || nextIsOprt)) {
                    // 二目运算（要求左右边要有项目）
                    //console.log(oprt, result);
                    let prevValue = result.pop(); // 当前操作符的前一项刚好是result的最后一项
                    if (nextZero instanceof Object) { // 下一项是运算好的关系
                        result.push(oprtFunc(nextZero, logic, prevValue));
                    } else { // 下一项是一目操作符！
                        let [nextNextType, nextNextValue] = flatted[i + 2] || [], // 操作符就牵扯到下下一项
                            nextNextItemUsable = ['child', 'relation'].includes(nextNextType); // 下下一项是否作为关系可用
                        if (nextNextItemUsable) {
                            let oprtRes = this.operatorFuncs[nextZero](nextNextValue[0], nextLogic); // 先把下一项的结果计算出来
                            result.push(oprtFunc(oprtRes, logic, prevValue)); // 再把结果带入二目运算
                            i = i + 1; // 再跳过一项
                        }
                    }
                    i = i + 1; // 下一项已经参与了计算，遂跳过
                } else if (oprtType === 1 && nextItemUsable) {
                    // 一目运算（要求右边有项目）
                    result.push(oprtFunc(nextZero, logic));
                    i = i + 1; // 下一项已经参与了计算，遂跳过
                } else if (probableRela) { // 关系名和操作符重名的情况
                    result.push(probableRela);
                } else {
                    throw `${bv.getLang('interpreter > operatorError.noRelation')}: ${oprt}`; // 操作符错误
                }
            } else { // child和relation返回的都是关系，一致处理
                result.push(value); // 关系直接推入结果列表
            }
        }
        return result; // 最后返回的应该是一个运算出的关系结果
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
    operatorFuncs: {
        // 操作符对应的函数，这些函数返回的全是计算好的关系
        select: function (after, expression, before) { // 选择(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})select executed:`, expression, after);
            after['sprocess'] = `select${counter}`;
            counter++;
            return after;
        },
        project: function (after, expression, before) { // 投影(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})project executed:`, expression, after);
            after['pprocess'] = `project${counter}`;
            counter++;
            return after;
        },
        union: function (after, expression, before) { // 并集(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})union executed:`, expression, after);
            after['uprocess'] = `union${counter}`;
            counter++;
            return after;
        },
        except: function (after, expression, before) { // 差集(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})except executed:`, expression, after);
            after['eprocess'] = `except${counter}`;
            counter++;
            return after;
        },
        intersect: function (after, expression, before) { // 交集(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})intersect executed:`, expression, after);
            after['iprocess'] = `intersect${counter}`;
            counter++;
            return after;
        },
        crossjoin: function (after, expression, before) { // 笛卡尔乘积(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})crossjoin executed:`, expression, after);
            after['cprocess'] = `crossjoin${counter}`;
            counter++;
            return after;
        },
        dividedby: function (after, expression, before) { // 除法(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})dividedby executed:`, expression, after);
            after['dprocess'] = `dividedby${counter}`;
            counter++;
            return after;
        },
        outerjoin: function (after, expression, before) { // 外连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})outerjoin executed:`, expression, after);
            after['oprocess'] = `outerjoin${counter}`;
            counter++;
            return after;
        },
        leftjoin: function (after, expression, before) { // 左连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})leftjoin executed:`, expression, after);
            after['lprocess'] = `leftjoin${counter}`;
            counter++;
            return after;
        },
        rightjoin: function (after, expression, before) { // 右连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})rightjoin executed:`, expression, after);
            after['rprocess'] = `rightjoin${counter}`;
            counter++;
            return after;
        },
        thetajoin: function (after, expression, before) { // 对称连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})thetajoin executed:`, expression, after);
            after['tprocess'] = `thetajoin${counter}`;
            counter++;
            return after;
        },
        naturaljoin: function (after, expression, before) { // 自然连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})naturaljoin executed:`, expression, after);
            after['nprocess'] = `naturaljoin${counter}`;
            counter++;
            return after;
        }
    }
};
let counter = 0;