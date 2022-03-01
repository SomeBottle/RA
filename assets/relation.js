/*关系表处理部分*/
'use strict';
const Relations = function (name = false) { // 关系表处理构造函数(关系名)
    var prevRelationBase = localStorage['RARelationBase'], // 读取本地的关系集
        relationBase = prevRelationBase ? JSON.parse(prevRelationBase) : {};
    this.name = name;
    this.base = name !== false ? relationBase[name] : relationBase; // 返回关系表/关系集

    this.save = function () { // 存入本地存储
        localStorage['RARelationBase'] = JSON.stringify(relationBase);
    }
    this.write = function (tableObj) { // 创建或者写入关系表(关系表对象)
        let that = this,
            name = that.name;
        return new Promise((res, rej) => {
            let firstRow = tableObj[0], // 第一行是列名（属性名）
                firstLen = firstRow.length,
                attrs = [], // 为属性新建一个数组，元组属性值数量也以此为标准
                tuples = tableObj.slice(1), // 剩下的是元组（属性值）
                exist = relationBase.hasOwnProperty(name); // 关系表是否事先存在
            for (let i = 0; i < firstLen; i++) { // 检查字段合理性
                let field = firstRow[i]; // 当前字段
                if (!field.notEmpty()) {
                    throw 'relation.columnEmpty'; // 有空列名
                } else if (attrs.indexOf(field) !== -1) {
                    throw 'relation.columnRepeat'; // 有重复列名
                }
                attrs.push(field); // 没有问题就将字段推入数组
                for (let j = 0, len = tuples.length; j < len; j++) {
                    let current = tuples[j][i];
                    tuples[j][i] = (current == undefined) ? null : current; // 缺少的地方记录为NULL
                }
            }
            relationBase[name] = { // 存入(或覆盖)关系表
                'attrs': attrs,
                'tuples': tuples
            };
            that.save(); // 存入本地存储
            res([exist, 'relation.writeSuccess']); // 写入成功
        })
    }
    this.writeSingleVal = function (val, row, col) { // 单独写入一个值(关系名,值,行,列)
        relationBase[this.name]['tuples'][row][col] = val;
        this.save(); // 存入本地存储
    }
    this.moveTuple = function (row, targetRow) { // 移动元组(关系名,行,目标行)
        let name = this.name,
            tuples = relationBase[name]['tuples'],
            moving = tuples[row], // 要移动的元组
            maxInd = tuples.length - 1; // 最大索引
        if (targetRow > maxInd) { // 目标行超出范围
            targetRow = 0; // 目标行超出范围，则目标行设为0
        } else if (targetRow < 0) { // 目标行小于0
            targetRow = maxInd; // 目标行小于0，则目标行设为最大索引
        }
        tuples.splice(row, 1); // 删除原位置的元组
        tuples.splice(targetRow, 0, moving); // 插入目标位置
        relationBase[name]['tuples'] = tuples; // 更新关系表
        this.save(); // 存入本地存储
        return [true, targetRow]; // 返回目标行
    }
    this.insertEmptyTuple = function (row) { // 插入空元组(关系名,行)
        let name = this.name,
            relation = relationBase[name],
            tuples = relation['tuples'],
            attrsNum = relation['attrs'].length, // 属性数量
            newTuple = new Array(attrsNum).fill(''); // 新的空元组
        tuples.splice(row, 0, newTuple); // 插入空元组
        relationBase[name]['tuples'] = tuples; // 更新关系表
        this.save(); // 存入本地存储
        return [true, row];
    }
    this.delTuple = function (row) { // 删除元组(关系名,行)
        let name = this.name,
            tuples = relationBase[name]['tuples'],
            tuplesNum = tuples.length;
        if (tuplesNum > 1) { // 起码要有一个元组
            tuples.splice(row, 1); // 删除元组
            this.save(); // 存入本地存储
            return [true, row];
        } else {
            return [false, 'relation.noEnoughTuple'];
        }
    }
    this.del = function () { // 删除关系表
        delete relationBase[this.name];
        this.save(); // 存入本地存储
    }
};
Relations.parseCsv = function (content) { // 解析CSV文件
    /* 
        详见https://en.wikipedia.org/wiki/Comma-separated_values#Basic_rules 
        本parseCsv解析器：
        1. 支持普通的CSV解析
        2. 支持引号和逗号的转义
        3. 不支持字段的换行
        - Somebottle20220223
    */
    let lines = content.trim().split(/[\r\n]/), // 按换行符分割为行
        tableArr = []; // 初始化关系表数组
    lines.forEach(function (line) {
        let row = [], // 初始化每一行
            commaSplit = line.split(','), // 先按逗号分割
            concat = false; // 是否连接row的最后一项和当前检索到的commaSplit项(commaPart)的字符串，值为true代表有落单的引号
        for (let i = 0, len = commaSplit.length; i < len; i++) { // 遍历preSplit
            let preVal = row.slice(-1)[0] || '', // 这一行当前的最后一个分量
                commaPart = commaSplit[i], // 当前检索的逗号分隔后的元素
                quotesMatch = commaPart.match(/"/g), // 匹配引号
                quotesNum = quotesMatch ? quotesMatch.length : 0; // 当前检索的逗号分隔后的元素中引号的数量
            if (concat) {
                row[row.length - 1] = `${preVal},${commaPart}`; // 需要连接就将其和当前行最后一项用逗号连接
            } else {
                row.push(commaPart); // 无需连接就把这一项加到这一行的末尾
            }
            /* 
                如果当前项包含的引号数目为奇数，就需要修正逗号分隔
                比如"a,b",c，分隔出来后为['"a','b"','c']，前面的"a只有奇数个引号，后面的b"也只有奇数个，
                这两项就应该重新连接起来，也就是变成['"a,b"','c']
                由此也需要保证落单的引号要在开头，所以要用到startsWith，而保证闭合用的引号在末尾，需要用到endsWith
            */
            let ifEven = (quotesNum % 2 == 0), // 引号数量是不是偶数
                ifOdd = !ifEven && quotesNum > 0; // 引号数量是不是大于0的奇数
            if (!concat && ifOdd && commaPart.startsWith('"')) {  // 之前没有任何落单引号(concat=false)的情况下，遇到落单的引号，需要连接，未闭合
                concat = true;
            } else if (concat && ifOdd && commaPart.endsWith('"')) { // 在已经有落单引号(concat=true)的情况下，再次遇到落单引号，就算闭合了，无需更多连接
                concat = false;
            }
        }
        row = row.map(x => {
            let takeQuote = x.replace(/^"(.+?)"$/g, (match, p1) => p1); // 去掉包囊用的引号
            return takeQuote.replaceAll(/""/g, '"'); // 将结对引号替换成单个引号
        });
        tableArr.push(row); // 将本行推入关系表数组
    });
    return tableArr;
}
Relations.toCsv = function (tableArr) { // 恢复为CSV文件
    let csv = '';
    for (let i = 0, len = tableArr.length; i < len; i++) {
        tableArr[i] = tableArr[i].map(x => {
            // 针对逗号和引号特殊处理
            return x && x.match(/"|,/g) ? `"${x.replaceAll('"', '""')}"` : x;
        }); // 去除未知项
        csv += tableArr[i].join(',') + '\n';
    }
    return csv;
}