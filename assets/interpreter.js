/* 关系代数解释器 */
'use strict';
/* 这里写一个小记记录一下这个破解释器的原理，以防以后忘记!( ・∀・)っ■
    1. 入口
        解释器的入口是函数understand(语句)
        在传入语句之后，其通过逐字符遍历，将语句字符串按照括号划分不同深度，
        并将括号内的内容推入tree数组相应的深度中，
        最后所有括号中的内容都会被放在数组中，可以说这里一层层数组就是括号。
            - 主要原理是：每次碰到左括号后，标记深度+1，记录接下来遍历的字符。在碰到右括号后，将刚才遍历的字符拼接成串，将字符串推入tree数组相应的分支中，标记深度-1。
            - 推入相应深度专门用了一个函数diver(数组,深度)来实现，这个函数会创建并返回数组一定深度的分支数组
                * 比如a=[]，depth=4，那么diver(a,depth)将会将a数组拓展为[[[[]]]]（如果相应数组存在元素就是取数组的最后一位），然后创建最内层的数组，也就是变成[[[[[]]]]]，并返回其引用，也就是a[0][0][0][0][0]
    2. 树&分支展平
        在understand函数将语句解析成简单的树tree后，会将其传给branchParser函数。
        这一部分主要靠branchParser和flattenTree两个函数互相不停调用实现（这大概不叫递归）
        首先branchParser会先调用flattenTree函数（如字面意思，将树展平）。flattenTree函数会遍历当前分支(tree/branch)的表层，根据每一项的类型进行处理：
            - 是文本，能找到对应操作符，记录操作符(operator)
                * 注意这里还有一种情况就是关系名和操作符重名，虽然这里会被认为是操作符，但在后续分析中其仍会被筛出来。（当然我是非常不建议关系名这样写，自己都容易搞混）
            - 是文本，能找到对应关系，记录关系(relation)
            - 是数组，记作子语句(child)，同时子语句作为树的分支，传给branchParser函数进行运算分析
        上面第三步可以说是解析括号的核心了，branchParser最开始就又会调用flattenTree，而flattenTree遇到当前分支中的child就又会再次调用branchParser，循环往复调用直到最内层的括号。最后由内至外一层一层传出运算结果。
        这也是为什么这个函数叫flattenTree（树展平）了，当所有括号内语句被运算完后在最表层数组只会留下运算好的关系，到最后整个树里就只有关系而没有括号了（也就是把括号全部算出来，只剩下一层）。

    3. 分支语句分析&运算
        如上面第2部分所述，branchParser是拿着flattenTree处理后的分支进行分析的，所以仅需要关心分支表层，也就是只用一层循环就能达成目的。
            【示例branch】
            [
                0: ['operator', ['project', 'columnA'], 'PROJECT{columnA}']
                1: ['child', Array(1), Array(1)]
                2: ['operator', ['except', ''], 'EXCEPT']
                3: ['operator', ['project', 'columnA'], 'PROJECT{columnA}']
                4: ['child', Array(1), Array(5)]
                5: ['operator', ['union', ''], 'UNION']
                6: ['child', Array(1), Array(1)]
            ]
        分析(每个循环执行的循环体)的过程是这样的：
            (0) 构造结果数组result
            (1) 如果当前项目(i)是子语句运算结果或现有关系(都是关系)：
                - 将当前结果推入结果数组result
            (2) 如果当前项目(i)是运算符(operator)：
                - 是双目运算：
                    * 先取出当前项在分支中的前一项(i-1)和后一项(i+1)
                        $ 针对前一项：判断是不是关系(child和relation类)
                        $ 针对后一项：判断是不是关系或者一目运算符（因为存在二目运算后接一目运算符的情况）
                        【例】 A EXCEPT SELECT{...}(RELATION)
                        $ Q：为什么不判断前一项是不是一目运算符呢？
                            # 其一，因为树形化的时候是按括号划分的，前一项就算是一目运算符，也会以括号结尾，判断结果就是relation类型
                            【例】 SELECT{...}(RELATION) EXCEPT A
                            # 其二，因为一个分支中运算顺序是自左向右的，前一项已经运算好了，是现成的关系。
                    * 接着取出结果数组result的最后一项，这里相当于当前运算符的左结合值（因为遍历语句的顺序是从左往右的，运算结果也是按这个顺序push到result数组中，运算符左边按理来说应该是已经算好的关系，作为result数组中的最后一项而存在）

*/
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
            counter++;
            return after;
        },
        project: function (after, expression, before) { // 投影(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})project executed:`, expression, after);
            counter++;
            return after;
        },
        union: function (after, expression, before) { // 并集(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})union executed:`, expression, before, after);
            counter++;
            return before;
        },
        except: function (after, expression, before) { // 差集(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})except executed:`, expression, before, after);
            counter++;
            return before;
        },
        intersect: function (after, expression, before) { // 交集(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})intersect executed:`, expression, before, after);
            counter++;
            return before;
        },
        crossjoin: function (after, expression, before) { // 笛卡尔乘积(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})crossjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        dividedby: function (after, expression, before) { // 除法(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})dividedby executed:`, expression, before, after);
            counter++;
            return before;
        },
        outerjoin: function (after, expression, before) { // 外连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})outerjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        leftjoin: function (after, expression, before) { // 左连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})leftjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        rightjoin: function (after, expression, before) { // 右连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})rightjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        thetajoin: function (after, expression, before) { // 对称连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})thetajoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        naturaljoin: function (after, expression, before) { // 自然连接(右边的关系,逻辑表达式,左边的关系)
            console.log(`(${counter})naturaljoin executed:`, expression, before, after);
            counter++;
            return before;
        }
    }
};
let counter = 10;