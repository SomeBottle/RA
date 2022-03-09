/* 演示动画部分
关系代数的运算实际上可以分成一个一个的二元运算或者对关系自身的运算，因此动画针对的也正是两个关系表及其元组
SomeBottle 20220305
*/
'use strict';
const Plays = function (targetElem) {
    let context = targetElem.getContext('2d'),
        initStyle = function () {
            // 设置绘制样式
            context.textAlign = 'center'; // 文字水平居中
            context.textBaseline = 'middle'; // 文字基线居中
            context.font = '1em Fira Code, Monaco, Consolas, Ubuntu Mono, PingFang SC, Hiragino Sans GB, Microsoft YaHei, WenQuanYi Micro Hei, monospace, sans-serif';
            context.fillStyle = '#FAFAFA';
            context.strokeStyle = '#FFF';
            context.lineWidth = 1; // 线宽
        };
    this.target = targetElem;
    this.context = context;
    this.cellPaddingX = 10; // 单元格的水平padding
    this.cellPaddingY = 10; // 单元格的垂直padding
    initStyle(); // 初始化样式
    this.setSize = function (canvasW, canvasH) {
        let canvas = targetElem;
        canvas.width = canvasW;
        canvas.height = canvasH;
        initStyle(); // resize后canvas属性会归为默认，重新初始化
    }
    this.columnSize = function (table) { // 返回关系表所有的列宽列高(关系表,x轴边缘,y轴边缘)
        let ctx = this.context, // 创建画布对象
            sizes = [[], []],
            columnNum = table[0].length,
            height = [],
            paddingX = this.cellPaddingX,
            paddingY = this.cellPaddingY;
        for (let i = 0; i < columnNum; i++) {
            let width = 0;
            for (let j = 0, len = table.length; j < len; j++) {
                let measurement = ctx.measureText(table[j][i]),
                    strWid = measurement.width,
                    // 这两个属性出现在比较新的规范里，要考虑一下浏览器兼容性，如果不支持就是15
                    strHei = (measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent) || 15;
                strWid = strWid + (paddingX * 2);
                strHei = strHei + (paddingY * 2);
                if (strWid >= width) width = strWid;
                if (strHei >= (height[j] || 0)) height[j] = strHei;
            }
            sizes[0].push(width);
        }
        sizes[1] = height;
        return sizes;
    }
    this.measureTable = function (relaArr, marginX, marginY) {
        /* 测量关系表(关系对象数组,x轴偏差,y轴偏差)
           根据所有表宽高和margin运算并返回：
           [画布宽,画布高]
        */
        let canvasWd = 0, canvasHt = 0;
        for (let i = 0, len = relaArr.length; i < len; i++) {
            let relaObj = relaArr[i],
                table = Array.from(relaObj['tuples']); // 关系表（浅拷贝）
            table.splice(0, 0, relaObj['attrs']); // 将属性名放入表中
            let [widths, heights] = this.columnSize(table), // 获取列宽列高
                rowWidth = widths.reduce((a, b) => a + b + 2, 0), // 获取表的宽度
                columnHeight = heights.reduce((a, b) => a + b + 2, 0), // 获取表的高度
                marginHt = columnHeight + marginY * 2;
            canvasWd = canvasWd + rowWidth + marginX * 2;
            canvasHt = canvasHt < marginHt ? marginHt : canvasHt;
        }
        return [canvasWd, canvasHt];
    }
    this.drawTable = function (relaObj, marginX, marginY, offsetX = 0, offsetY = 0) {
        /*
        绘制关系表(关系对象,x轴margin,y轴margin,x轴偏差,y轴偏差)
        返回：[当前表的宽,当前表的高]
        */
        let ctx = this.context, // 创建画布对象
            table = Array.from(relaObj['tuples']); // 浅拷贝
        table.splice(0, 0, relaObj['attrs']); // 将属性名放入表中
        let [widths, heights] = this.columnSize(table),
            rowWidth = widths.reduce((a, b) => a + b + 2, 0), // 获取表的宽度
            columnHeight = heights.reduce((a, b) => a + b + 2, 0); // 获取表的高度
        ctx.restore();
        let verticalDrawn = false; // 是否已经绘制了垂直线
        offsetX = offsetX + marginX;
        offsetY = offsetY + marginY;
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX + rowWidth, offsetY);
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX, offsetY + columnHeight);
        for (let i = 0, len = table.length; i < len; i++) {
            let row = table[i],
                ht = heights.slice(0, i + 1).reduce((a, b) => a + b + 2, 0),
                y = offsetY + ht;
            ctx.moveTo(offsetX, y);
            ctx.lineTo(offsetX + rowWidth, y);
            for (let j = 0, len2 = row.length; j < len2; j++) {
                let wd = widths.slice(0, j + 1).reduce((a, b) => a + b + 2, 0),
                    x = offsetX + wd,
                    text = row[j],
                    textWd = widths[j],
                    textHt = heights[i]; // 获取文字宽高
                if (!verticalDrawn) {
                    ctx.moveTo(x, offsetY);
                    ctx.lineTo(x, offsetY + columnHeight);
                }
                ctx.fillText(text, x - textWd / 2, y - textHt / 2);
            }
            verticalDrawn = true;
        }
        ctx.stroke();
        let tableWidth = rowWidth + marginX * 2,
            tableHeight = columnHeight + marginY * 2;
        return [tableWidth, tableHeight];
    }
}