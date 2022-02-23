/*关系表处理部分*/
'use strict';
const relations = {
    parseCsv: function (content) { // 解析CSV文件
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
    },
    write: function (name, tableArr) { // 创建或者写入关系表(关系名,关系表对象)

    }
};