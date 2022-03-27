/* 关系代数解释器 */
'use strict';
/* 这里写一个小记记录一下这个破解释器的原理，以防以后忘记!( ・∀・)っ■
    0. 注意事项：使用和运算符同名的关系时一定要用括号括起来！
        【例】A UNION EXCEPT ×
             A UNION (EXCEPT) √
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
                0: ['operator', ['project', 'columnA'], 'PROJECT{columnA}', 语句起始位置]
                1: ['child', Array(1), Array(1), 语句起始位置]
                2: ['operator', ['except', ''], 'EXCEPT', 语句起始位置]
                3: ['operator', ['project', 'columnA'], 'PROJECT{columnA}', 语句起始位置]
                4: ['child', Array(1), Array(5), 语句起始位置]
                5: ['operator', ['union', ''], 'UNION', 语句起始位置]
                6: ['child', Array(1), Array(1), 语句起始位置]
            ]
        分析(每个循环执行的循环体)的过程是这样的：
            (0) 构造结果数组result
            (1) 如果当前项目(i)是子语句运算结果或现有关系(都是关系)：
                - 将当前结果推入结果数组result
            (2) 如果当前项目(i)是运算符(operator)：
                - 是双目运算：
                    * 先取出当前项在分支中的前一项(i-1)和后一项(i+1)
                        $ 针对前一项(i-1)：判断是不是关系(child和relation类)
                        $ 针对后一项(i+1)：判断是不是关系或者一目运算符（因为存在二目运算后接一目运算符的情况）
                        【例】 A EXCEPT SELECT{...}(RELATION)
                        $ 为什么不判断前一项是不是一目运算符呢？
                            # 其一，因为树形化的时候是按括号划分的，前一项就算是一目运算符，也会以括号结尾，判断结果就是relation类型
                            【例】 SELECT{...}(RELATION) EXCEPT A
                            # 其二，因为一个分支中运算顺序是自左向右的，前一项已经运算好了，是现成的关系。
                    * 如果前一项(i-1)符合上述要求，接着取出结果数组result的最后一项，这里相当于当前运算符的左结合值（因为遍历语句的顺序是从左往右的，运算结果也是按这个顺序push到result数组中，运算符左边按理来说应该是已经算好的关系，作为result数组中的最后一项而存在）
                    * 接着检查后一项(i+1)
                        $ 如果这一项是关系，直接传入对应的运算函数：
                          oprtFunc([
                              后一项(i+1),前一项(result最后一个元素)
                            ],
                            逻辑表达式,
                            [
                                后一项语句的位置,运算符语句的位置,前一项语句的位置
                            ]
                        )
                          将函数返回的结果推入结果数组result
                          最后将i+1以跳过后一项（因为这一项已经参与运算了）
                          【例】 SELECT{...}(RELATION) EXCEPT A
                                树形化后：['SELECT{...}',[RELATION],]
                                其中A就算“后一项”，是一个关系
                        $ 如果这一项是一目运算，则先把这个一目运算完成，再把结果作为“后一项”传入运算函数(oprtFunc)，运算结果推入数组result
                          在这之后要进行i+2操作，因为从当前项到后面两项都已经参与了运算。
                          【例】 A UNION SELECT{...}(RELATION)
                             树化：['A','UNION','SELECT{...}',[RELATION]]
                             当前项是UNION的话，后面SELECT{...}和[RELATION]都会参与运算，所以在运算完后进行i+2操作
                - 是单目运算：
                    * 只需要取出当前项在分支中的后一项(i+1)，判断是不是关系（child,relation类）
                    * 如果后一项符合上述条件，随逻辑表达式一同传入运算函数(oprtFunc)，运算结果推入数组result。
                    * 接下来和之前的一样，进行i+1操作。
                - 双目运算不是，单目运算也不是的话，
                  判断这个项目(i)是不是和运算符同名的关系，如果是的话，将该关系推入数组result。
                    【例】A EXCEPT (EXCEPT)
                       树化后：['A','EXCEPT',['EXCEPT']]
                       最开始会认为第二个except是运算符，但很快程序就发现EXCEPT左边和右边都没有关系，找了一下发现有关系名也叫EXCEPT，所以将关系推入第二层（因为是在括号内）的数组result。

        通过这几步分析，整个语句从括号内层到外层，从左至右逐一执行。
        到最后，最外层branchParser返回的result数组只会剩下一个元素，也就是结果关系，运算结束。
        - SomeBottle 2022.3.24
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
        console.time("understand");
        let tree = [], // 语句树
            depth = 0,
            strBuffer = '',
            posBuffer = -1, // 储存当前指针位置
            bv = basicView,
            bufferer = (chr, ind = 0) => { // 将字符连成字符串
                // 没有遇到空字符或者括号就算同一节字符串
                if (chr && !(/\s/).test(chr) && !['(', ')'].includes(chr)) {
                    strBuffer = strBuffer + chr;
                    if (posBuffer === -1) posBuffer = ind; // 储存当前字符串的起始位置
                } else if (strBuffer) { // 一小段字符串连接完成
                    let branch = this.diver(tree, depth);
                    branch.push({
                        command: strBuffer,
                        pos: posBuffer
                    }); // 把指令和位置推入树分支，树形化
                    posBuffer = -1;
                    strBuffer = '';
                }
            };
        for (let i = 0, len = statements.length; i < len; i++) {
            let chr = statements[i]; // 当前字符
            bufferer(chr, i); // 就放在此处，在处理深度之前处理字符
            if (chr === '(') {
                depth++;
            } else if (chr === ')') {
                depth--;
            }
        }
        bufferer(false); // 清空缓冲区
        if (depth !== 0) throw bv.getLang('interpreter > syntaxError.parenthesisLeft'); // 括号未闭合错误
        console.log(tree);
        console.log(this.branchParser(tree)); // 解析树语句
        console.timeEnd("understand");
    },
    flattenTree: function (tree) { // 分析语句，最后输出结果只剩一层
        let treeLen = tree.length,
            bv = basicView,
            result = []; // 每一项为[操作类型,值,原项目]
        for (let i = 0; i < treeLen; i++) {
            let item = tree[i];
            if (item instanceof Array) { // 如果是数组，就相当于括号，则递归
                let { pos } = this.dig(item, true); // 尝试挖出子语句的开头位置
                result.push(['child', this.branchParser(item), item, pos]); // child的值就是关系
            } else {
                let { command, pos } = item,
                    oprt = this.findOperator(command); // 找到操作符
                if (!oprt) {
                    let relation = relaObj.x(command).base;
                    if (relation) { // 如果是关系
                        result.push(['relation', relation, command, pos]);
                    } else {
                        throw `[Pos: ${pos}] ${bv.getLang('interpreter > referenceError.notDefined')}: ${command}`; // 找不到关系的错误
                    }
                } else { // 操作符有效
                    result.push(['operator', oprt, command, pos]);
                }
            }
        }
        return result;
    },
    dig: function (childArr, force = false) {
        /* 这个函数专门用于处理branchParser中child的部分，因为child作为子语句，运算出来的结果可能是透过好多层括号的：
            例如：
            A UNION (B) -树形化-> ['A','UNION',['B']]
                        -准备UNION-> 
                            UNION左结合：A关系对象
                            UNION右结合：[B关系对象]
            A UNION ((B)) -树形化-> ['A','UNION',[['B']]]
                          -准备UNION->
                            UNION左结合：A关系对象
                            UNION右结合：[[B关系对象]]
            很明显能发现套的括号越多最终用于结合的数组层次越多，所以这里需要“挖”到最深处取到B关系对象
          本函数的作用：将最里层的结果提取出来
            例如：[[[{name: 'STUDENT', attrs: Array(3), tuples: Array(5)}]]]，处理成{name: 'STUDENT', attrs: Array(3), tuples: Array(5)}
                  [[[a],2]]，处理成[[a],2]
            如果指定强制(force=true)，那么[[[a],2]]会被处理成a
            SomeBottle20220326
        */
        let pointer = childArr;
        while ((pointer instanceof Array) && (force || pointer.length === 1)) {
            pointer = pointer[0];
        }
        return pointer;
    },
    branchParser: function (branch) { // 分析树分支
        let flatted = this.flattenTree(branch), // 展平树（将括号内的子语句运算完成）
            branchLen = flatted.length,
            bv = basicView,
            result = [];
        for (let i = 0; i < branchLen; i++) {
            // [类型(操作符operator,子关系child,关系relation),值,原语句,原语句起始位置]
            let [type, value, origin, originPos] = flatted[i];
            if (type === 'operator') {
                let [oprt, logic] = value, // [操作符,逻辑表达式]
                    [, , , prevPrevPos] = flatted[i - 2] || [],
                    [prevType, prevValue, , prevPos] = flatted[i - 1] || [], // 前一项，二元运算需要用到
                    prevItemUsable = ['child', 'relation'].includes(prevType), // 前一项是否可用(二目运算要用)
                    [nextType, nextValue, , nextPos] = flatted[i + 1] || [[], []], // 获得下一项，这一项无论一元还是二元，都是需要的
                    nextItemUsable = ['child', 'relation'].includes(nextType), // 下一项是否作为关系可用
                    probableRela = relaObj.x(origin).base, // 可能是关系
                    oprtFunc = this.operatorFuncs[oprt], // 操作符的函数
                    oprtType = this.oprtTypes[oprt], // 操作符是一目还是二目
                    nextZero, nextLogic, nextIsOprt;
                // 优先找有没有前前项，如果有，那么前一项就是child，取prevPrevPos；如果没有，那么前一项就是relation，取prevPos
                prevPos = prevPrevPos || (prevPos || 0);
                if (nextValue instanceof Array) { // 下一项如果是Array，就是child，如果是Object，则为relation
                    [nextZero, nextLogic] = nextValue || []; // 下一项数组的0位，可能是操作符，也可能是运算好的关系（考虑到下一项可能是一目运算）
                    nextIsOprt = this.oprtTypes[nextZero] === 1; // （考虑到下一项可能是一目运算）
                } else {
                    nextZero = nextValue; // 下一项是relation，直接赋值nextValue
                }
                if (oprtType === 2 && prevItemUsable && (nextItemUsable || nextIsOprt)) {
                    // 二目运算（要求左右边要有项目）
                    let prevValue = result.pop(); // 当前操作符的前一项刚好是result的最后一项
                    if (nextZero instanceof Object) { // 下一项是运算好的关系
                        result.push(oprtFunc([nextZero, prevValue], logic, [nextPos, originPos, prevPos])); // 将下一项关系和前一项运算结果放入result
                    } else { // 下一项是一目操作符！
                        let [nextNextType, nextNextValue, , nextNextPos] = flatted[i + 2] || [], // 操作符就牵扯到下下一项
                            [nextNextZero] = nextNextValue,
                            nextNextItemUsable = ['child', 'relation'].includes(nextNextType); // 下下一项是否作为关系可用
                        if (nextNextItemUsable) {
                            let oprtRes = this.operatorFuncs[nextZero]([nextNextZero], nextLogic, [nextNextPos, nextPos]); // 先把下一项的一目运算结果计算出来
                            result.push(oprtFunc([oprtRes, prevValue], logic, [nextPos, originPos, prevPos])); // 再把结果带入二目运算
                            i = i + 1; // 再跳过一项
                        } else {
                            throw `[Pos:${nextNextPos}] ${bv.getLang('interpreter > operatorError.lackRelation')}: ${nextZero}`; // 操作符错误
                        }
                    }
                    i = i + 1; // 下一项已经参与了计算，遂跳过
                } else if (oprtType === 1 && nextItemUsable) {
                    // 一目运算（要求右边有项目）
                    result.push(oprtFunc([nextZero], logic, [nextPos, originPos]));
                    i = i + 1; // 下一项已经参与了计算，遂跳过
                } else if (probableRela) { // 关系名和操作符重名的情况
                    result.push(probableRela);
                } else {
                    throw `[Pos:${originPos}] ${bv.getLang('interpreter > operatorError.lackRelation')}: ${oprt}`; // 操作符错误
                }
            } else { // child和relation返回的都是关系，一致处理
                // 多层括号的问题主要就出现在这里，详细看dig函数的注释
                result.push(this.dig(value)); // 关系直接推入结果列表
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
    distinctSet: function (arr) { // 集合去重
        arr = Array.from(arr); // 浅拷贝
        for (let i = 0, len = arr.length; i < len; i++) {
            let compare = arr[i];
            for (let j = 0, len2 = arr.length; j < len2; j++) {
                if (i == j) continue;
                let equal = arr[j].every((val, ind) => {
                    return val === compare[ind];
                })
                if (equal) {
                    arr.splice(j, 1);
                    i--;
                    j--;
                    len--;
                    len2--;
                }
            }
        }
        return arr;
    },
    arrEquals: function (arr1, arr2) { // 判断两个数组完全相等
        let arr1Len = arr1.length,
            arr2Len = arr2.length;
        if (arr1Len === arr2Len) {
            let existInds = []; // 防止[1,2,2,2,2]=[1,2,3,4]这样的情况出现
            for (let i = 0; i < arr1Len; i++) {
                let find = arr2.indexOf(arr1[i]);
                if (find !== -1 && !existInds.includes(find)) {
                    existInds.push(find);
                } else {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    },
    operatorFuncs: {
        // 操作符对应的函数，这些函数返回的全是计算好的关系(函数传参说明见文件顶部注释)
        select: function (relas, expression, positions) { // 选择
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions,
                comma = expression.split(','), // 逻辑表达式逗号分割
                selected = Object.assign({}, after), // 浅拷贝
                bv = basicView;
            for (let i = 0, len = comma.length; i < len; i++) {
                let item = comma[i].trim(),
                    // ATTR = 'VALUE'
                    matchingStr = item.match(/^(\S+?)\s*?=\s*?'([\s\S]+?)'$/),
                    // ATTR = NUM
                    matchingNum = item.match(/^(\S+?)\s*?=\s*?([0-9.]+?)$/),
                    matching = matchingStr || matchingNum;
                if (matching) {
                    let [, attr, value] = matching, // 属性名和值
                        attrIndex = selected['attrs'].indexOf(attr),
                        tuples = selected['tuples'],
                        result = [];
                    if (attrIndex === -1) throw `[Pos:${afterPos}] ${bv.getLang('interpreter > operatorError.noSuchAttr')}: ${attr}`; // 没有这个属性
                    for (let j = 0, len = tuples.length; j < len; j++) { // 选择出元组
                        let tuple = tuples[j];
                        if (tuple[attrIndex] === value) {
                            result.push(tuple);
                        }
                    }
                    selected['tuples'] = interpreter.distinctSet(result); // 更新为选择的元组(去重后)
                } else {
                    throw `[Pos:${selfPos}] ${bv.getLang('interpreter > operatorError.wrongLogic')}: ${item}`;
                }
            }
            console.log(`(${counter})select executed:`, selected);
            counter++;
            return selected;
        },
        project: function (relas, expression, positions) { // 投影
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions,
                comma = expression.split(','), // 逻辑表达式逗号分割
                relation = Object.assign({}, after), // 浅拷贝
                attrs = relation['attrs'],
                tuples = relation['tuples'],
                colLen = tuples.length, // 一列几个元组的分量
                projectedAttrs = [],
                projectedTuples = new Array(colLen).fill().map(v => []), // 构造新的集合
                bv = basicView;
            for (let i = 0, len = comma.length; i < len; i++) {
                let item = comma[i].trim(),
                    attrIndex = relation['attrs'].indexOf(item);
                if (attrIndex === -1) throw `[Pos:${afterPos}] ${bv.getLang('interpreter > operatorError.noSuchAttr')}: ${item}`;
                projectedAttrs.push(attrs[attrIndex]);
                for (let j = 0; j < colLen; j++) {
                    projectedTuples[j].push(tuples[j][attrIndex]);
                }
            }
            relation['attrs'] = projectedAttrs;
            // 别忘了去重操作
            relation['tuples'] = interpreter.distinctSet(projectedTuples);
            console.log(`(${counter})project executed:`, relation);
            counter++;
            return relation;
        },
        union: function (relas, expression, positions) { // 并集
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions,
                bv = basicView,
                beforeAttrs = before['attrs'],
                beforeTuples = before['tuples'],
                afterAttrs = after['attrs'],
                afterTuples = after['tuples'];
            if (!interpreter.arrEquals(beforeAttrs, afterAttrs)) { // 先看看属性列是不是一致的
                throw `[Pos:${beforePos},${afterPos}] ${bv.getLang('interpreter > unionError.attrsNotEqual')}`;
            }
            let unionedTuples = beforeTuples.concat(afterTuples);
            unionedTuples = interpreter.distinctSet(unionedTuples); // 去重
            console.log(`(${counter})union executed:`, expression, before, after);
            counter++;
            return {
                'attrs': beforeAttrs,
                'tuples': unionedTuples
            };
        },
        except: function (relas, expression, positions) { // 差集
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions,
                bv = basicView,
                beforeAttrs = before['attrs'],
                beforeTuples = before['tuples'],
                afterAttrs = after['attrs'],
                afterTuples = after['tuples'];
            if (!interpreter.arrEquals(beforeAttrs, afterAttrs)) { // 先看看属性列是不是一致的
                throw `[Pos:${beforePos},${afterPos}] ${bv.getLang('interpreter > exceptError.attrsNotEqual')}`;
            }
            beforeTuples = interpreter.distinctSet(beforeTuples); // 去重
            afterTuples = interpreter.distinctSet(afterTuples); // 去重
            let compared = []; // 把比对过的index存入，防止重复比对消耗资源
            for (let i = 0, len = beforeTuples.length; i < len; i++) {
                let tuple = beforeTuples[i];
                for (let j = 0, len2 = afterTuples.length; j < len2; j++) {
                    if (compared.includes(j)) continue; // 比对过的跳过
                    let tuple2compare = afterTuples[j];
                    if (interpreter.arrEquals(tuple, tuple2compare)) {
                        beforeTuples.splice(i, 1); // 左结合关系中删除和右结合关系共有的元组
                        compared.push(j);
                        i--;
                        len--;
                    }
                }
            }
            console.log(`(${counter})except executed:`, expression, before, after);
            counter++;
            return {
                'attrs': beforeAttrs,
                'tuples': beforeTuples
            };
        },
        intersect: function (relas, expression, positions) { // 交集
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions,
                bv = basicView,
                beforeAttrs = before['attrs'],
                beforeTuples = before['tuples'],
                afterAttrs = after['attrs'],
                afterTuples = after['tuples'];
            if (!interpreter.arrEquals(beforeAttrs, afterAttrs)) { // 先看看属性列是不是一致的
                throw `[Pos:${beforePos},${afterPos}] ${bv.getLang('interpreter > exceptError.attrsNotEqual')}`;
            }
            beforeTuples = interpreter.distinctSet(beforeTuples); // 去重
            afterTuples = interpreter.distinctSet(afterTuples); // 去重
            let compared = [], // 把比对过的index存入，防止重复比对消耗资源
                intersected = [];
            for (let i = 0, len = beforeTuples.length; i < len; i++) {
                let tuple = beforeTuples[i];
                for (let j = 0, len2 = afterTuples.length; j < len2; j++) {
                    if (compared.includes(j)) continue; // 比对过的跳过
                    let tuple2compare = afterTuples[j];
                    if (interpreter.arrEquals(tuple, tuple2compare)) {
                        intersected.push(tuple);
                        compared.push(j);
                    }
                }
            }
            console.log(`(${counter})intersect executed:`, expression, before, after);
            counter++;
            return {
                'attrs': beforeAttrs,
                'tuples': intersected
            };
        },
        crossjoin: function (relas, expression, positions) { // 笛卡尔乘积
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})crossjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        dividedby: function (relas, expression, positions) { // 除法
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})dividedby executed:`, expression, before, after);
            counter++;
            return before;
        },
        outerjoin: function (relas, expression, positions) { // 外连接
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})outerjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        leftjoin: function (relas, expression, positions) { // 左连接
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})leftjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        rightjoin: function (relas, expression, positions) { // 右连接
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})rightjoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        thetajoin: function (relas, expression, positions) { // 对称连接
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})thetajoin executed:`, expression, before, after);
            counter++;
            return before;
        },
        naturaljoin: function (relas, expression, positions) { // 自然连接
            let [after, before] = relas,
                [afterPos, selfPos, beforePos] = positions;
            console.log(`(${counter})naturaljoin executed:`, expression, before, after);
            counter++;
            return before;
        }
    }
};
let counter = 10;