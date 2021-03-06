/*RA 0.0.1*/
/*视图部分*/
'use strict';

const relaObj = new Relations(); // 构造一个relation对象常量

const basicView = { // 基础视图
    langList: {},
    currentLang: {},
    originalTemplates: '',
    prevCSVInput: '', // 储存输入的CSV，和nameInputChecker搭配
    modifyingCSV: false, // 是不是正在编辑CSV，和nameInputChecker搭配
    loadedPages: {},
    noticeTimer: null, // 通知相关定时器
    timerForReset: null, // 清空输入框相关定时器
    getLang: function (langStr) {
        /* 根据指示获取当前语言对应的文本，传入的字符串类似：'notice>relation.nameRequired' */
        let keyLayer = langStr.split('>').filter(x => x.notEmpty()).map(x => x.trim()),
            langPointer = this.currentLang;
        for (let i = 0, len = keyLayer.length; i < len; i++) {
            let objKey = keyLayer[i];
            if (langPointer[objKey]) { // 如果指针代表的对象属性存在
                langPointer = langPointer[objKey]; // 指针后移
            } else {
                return keyLayer.pop(); // 如果找不到就返回最后一个key
            }
        }
        return langPointer; // 最后没出错的话指针会指向一个字符串
    },
    motionChecker: function (element, func, checkAnim = false) { /* CSS3运动结束监听回调器(监听元素,回调函数,监听的是不是css3Animation) */
        let chosenTester = '', testers = checkAnim ? {
            'animation': 'animationend',
            'OAnimation': 'oAnimationEnd',
            'MozAnimation': 'animationend',
            'WebkitAnimation': 'webkitAnimationEnd'
        } : {
            'transition': 'transitionend',
            'OTransition': 'oTransitionEnd',
            'MozTransition': 'transitionend',
            'WebkitTransition': 'webkitTransitionEnd'
        };
        for (var i in testers) {
            if (element.style[i] !== undefined) {
                chosenTester = testers[i];
            }
        }
        function callBack() {
            element.removeEventListener(chosenTester, callBack);
            func();
            func = null;
        }
        element.addEventListener(chosenTester, callBack);
    },
    closeNotice: function () {
        let noticer = s('.notice');
        noticer.style.transform = 'translateY(-100%)';
        basicView.motionChecker(noticer, () => {
            s('.notice span').style.float = 'initial';
            s('.notice a').style.display = 'none';
        })
    },
    notice: function (content, needConfirm = false) { /*弹出提示(提示内容,是否要用户确认)*/
        let noticer = s('.notice'), bv = this;
        noticer.style.transform = 'translateY(0)';
        s('.notice span').innerHTML = content;
        if (needConfirm) {
            s('.notice span').style.float = 'left';
            s('.notice a').style.display = 'block';
        } else {
            clearInterval(bv.noticeTimer);
            bv.noticeTimer = setTimeout(bv.closeNotice, 1500);
        }
    },
    langRender: function (section, html) {
        let bv = this, langOBJ = bv.currentLang;
        /*获得选择的语言对应的配置文件*/
        /*找出所有的替换符号*/
        let matches = html.findTp(), viewLang = langOBJ[section];
        for (let single of matches) {
            /*如果在语言配置文件中有对应翻译，就替换上，反之就是缺失翻译，保留类似menu.howToUse的占位字串*/
            let theHolder = single[1];
            html = html.replaceTp(theHolder, viewLang[theHolder] || theHolder);
        }
        /*返回重渲染翻译后html*/
        return html;
    },
    fHook: function (resp) {/*用于判断fetch状态码的一个hook*/
        if (resp.status == 200) {
            return resp;
        } else {
            throw 'Error response, code:' + resp.status;
        }
    },
    nameInputChecker: () => { // 检查输入的关系名是否已经存在，存在就做出相关操作
        let bv = basicView,
            csvInput = s('#csvForm'),
            inputElem = s('#relationName'),
            relaName = inputElem.value,
            relation = relaObj.x(relaName).base;
        if (relation) {
            // 在输入存在的表单后自动还原成CSV格式
            // 先还原成表格数组
            let tableArr = [relation['attrs']].concat(relation['tuples']);
            bv.modifyingCSV = true;
            csvInput.value = Relations.toCsv(tableArr);
            s('.add').innerHTML = bv.getLang('basicView > relation.modify'); // 更改按钮文字为编辑
        } else if (bv.modifyingCSV) { // 之前刚刚编辑过表单，现在没有编辑了而是新增
            bv.modifyingCSV = false;
            s('.add').innerHTML = bv.getLang('basicView > relation.add'); // 更改按钮文字为添加
            csvInput.value = bv.prevCSVInput; // 还原之前输入的内容
        } else {
            bv.prevCSVInput = csvInput.value; // 记录csv输入内容
        }
    },
    init: function () {
        /*最先拉取语言*/
        let bv = this;
        fetch('./langs/index.json')
            .then((resp) => bv.fHook(resp).json())
            .then((resp) => {
                localStorage.RAchosenLang = localStorage.RAchosenLang || resp.defaultLang;
                /*载入语言列表*/
                bv.langList = resp.langList;
                /*选定语言*/
                let chosenLang = localStorage.RAchosenLang;
                console.log('Choose Language:' + bv.langList[chosenLang]);
                return fetch('./langs/' + chosenLang + '.json');
            })
            .then((langResp) => bv.fHook(langResp).json())
            .catch(error => {
                bv.notice('Language config load failed!', true);
                throw error;
            })
            .then((langResp) => {
                let basicView = s('.basicView'), basicViewTemplate = bv.originalTemplates || basicView.innerHTML;
                bv.currentLang = langResp;
                /*储存本来的容器模板，以后还有用*/
                bv.originalTemplates = basicViewTemplate;
                basicView.innerHTML = bv.langRender('basicView', basicViewTemplate);
                basicView.style.opacity = 1;
                /*初始化菜单，使点击事件与浮页关联*/
                let menuLinks = s('.menu a', true),
                    formInput = s('.formInput');
                for (let i in menuLinks) {
                    let e = menuLinks[i], attr = (typeof e == 'object' ? e.getAttribute('data-src') : null);
                    if (attr) e.addEventListener('click', () => bv.float(attr), false);
                }
                s('#relationName').addEventListener('input', bv.nameInputChecker, false); // 在关系名输入框加上监听器
                formInput.onmousedown = bv.startClear.bind(bv); // 长按csv输入框清空
                formInput.ontouchstart = bv.startClear.bind(bv); // 适应移动端
                s('.execBtn').onclick = () => { // 执行关系代数
                    let program = s('.algebraInput').value;
                    if (program.notEmpty()) {
                        interpreter.understand(program); // 送至解释器
                    } else {
                        bv.notice(bv.getLang('basicView > algebra.empty'));
                    }
                };
            })
    },
    startClear: function (ev) { // 开始准备清除输入框
        let bv = this,
            touchSupported = ("ontouchstart" in window), // 支持touchEvent与否
            waitTime = touchSupported ? 1200 : 1000, // 支持touchEvent等的时间长一点
            waitBar = s('.formInput .waitBar'), // 清除进度条
            csvInput = s('#csvForm'), // csv输入框
            nameInput = s('#relationName'); // 关系名输入框
        applyStyle(waitBar, {
            'width': '100%',
            'height': '100%',
            'border-radius': '0'
        });
        clearTimeout(bv.timerForReset); // 清除先前的计时器，防止重复
        bv.timerForReset = setTimeout(() => {
            csvInput.blur(); // 失去焦点
            csvInput.value = '';
            nameInput.value = ''; // 清空输入框
            bv.abortClear(); // 调用一次取消清除函数来让进度条返回初始状态
            bv.nameInputChecker(); // 重设按钮文本
        }, waitTime);
        function abort() {
            window.removeEventListener('mouseup', abort, false);
            window.removeEventListener('touchend', abort, false); // 移除事件
            window.removeEventListener('touchcancel', abort, false);
            window.removeEventListener('mousemove', abort, false);
            window.removeEventListener('touchmove', abort, false);
            bv.abortClear();
        }
        window.addEventListener('touchcancel', abort, false); // (支持touchEvent)选中文本时取消清除
        window.addEventListener('touchend', abort, false); // (支持touchEvent)触点消失时取消清除
        window.addEventListener('mouseup', abort, false); // 在鼠标抬起时取消清除
        setTimeout(() => { // 移动事件需要稍微延迟一下
            if (!touchSupported) window.addEventListener('mousemove', abort, false); // (不支持touchEvent)鼠标移动就取消清除（这样可以划选内容）
            window.addEventListener('touchmove', abort, false); // 考虑支持touchEvent的情况(touchmove和上一行mousemove有冲突，所以在支持touch的时候就用touchmove)
        }, 100);
    },
    abortClear: function () { // 取消/停止清除
        let bv = this,
            waitBar = s('.formInput .waitBar');
        clearTimeout(bv.timerForReset); // 清除计时器
        applyStyle(waitBar, {
            'width': '0%',
            'height': '0%',
            'border-radius': '2em'
        });
    },
    float: async function (page, funcOnResp = false) {/*(要载入的页面,对请求返回的html内容进行处理的函数)*/
        let fl = s('.floatLayer'),
            fc = s('.floatContent'),
            bv = this,
            loaded = bv.loadedPages[page],
            localPage = Promise.resolve(loaded),
            applyPage = await (loaded ? localPage : fetch('./pages/' + page + '.html')
                .then((resp) => bv.fHook(resp).text()).catch(e => {
                    bv.notice(bv.getLang('notice > page.loadFailed'), true);
                    funcOnResp = null;
                    throw e;
                })
            );
        bv.loadedPages[page] = applyPage;
        fc.innerHTML = funcOnResp ? funcOnResp(applyPage) : applyPage;
        fl.style.display = 'block';
        applyStyle(fl, {
            'opacity': 1
        }, 50);
        funcOnResp = null;
    },
    close: function () {
        let fl = s('.floatLayer'),
            fc = s('.floatContent'),
            bv = this;
        fl.style.opacity = 0;
        bv.motionChecker(fl, () => {
            fl.style.display = 'none';
            fc.innerHTML = '';
        });
    }
};

const relationView = { // 关系表相关的视图
    modifyTemplate: {
        'main': '', // relationModify主模板
        'table': '' // relationModify表格模板
    }, // 关系表模板
    modifyingCell: [], // 正在被修改的单元格[列序,行序]
    all: function () {/*查看所有的表*/
        let bv = basicView,
            rv = this,
            nameInput = s('#relationName'); // 关系名输入框
        basicView.float("relationThumb", (resp) => {
            let template = resp, // relationThumb.html是模板
                relas = relaObj.x().base, // 临时引用关系集
                rendered = ''; // 渲染后的html
            for (let i in relas) { // 遍历关系表集
                let temp = template.replaceTp('relationName', i); // 替换模板中的关系名
                temp = temp.replaceTp('attributes', relas[i]['attrs'].join(','));  // 替换模板中的属性列
                rendered += bv.langRender("relationView", temp); // 添加到渲染后的html
            }
            return rendered || `<p>${bv.getLang('relationView > relation.noItem')}</p>`;
        }).then(res => {
            let thumbFoots = s('.singleThumb > .foot', true);
            for (let foot of thumbFoots) { // 关系表缩略底部按钮
                ((foot) => {
                    let parentThumb = foot.parentNode,
                        name = parentThumb.getAttribute('data-name'), // 获得关系名
                        csvBtn = foot.querySelector('.csvBtn'), // 获得csv按钮
                        delBtn = foot.querySelector('.delBtn'), // 获得删除按钮
                        nameBtn = foot.querySelector('.nameBtn'), // 获得改名按钮
                        editCSV = () => {
                            bv.close();
                            nameInput.value = name; // 填充关系名
                            bv.nameInputChecker(); // 触发编辑
                            delBtn.removeEventListener('click', delRela, false);
                            csvBtn.removeEventListener('click', editCSV, false);
                            nameBtn.removeEventListener('click', chName, false);
                        },
                        delRela = () => {
                            if (confirm(bv.getLang('relationView > relation.delConfirm'))) {
                                delBtn.removeEventListener('click', delRela, false);
                                csvBtn.removeEventListener('click', editCSV, false);
                                nameBtn.removeEventListener('click', chName, false);
                                relaObj.x(name).del(); // 删除关系表
                                parentThumb.remove(); // 重新渲染
                            }
                        },
                        chName = () => {
                            let newName = prompt(bv.getLang('relationView > relationItem.changeName'), name);
                            if (newName && newName.notEmpty()) {
                                let [success, msg] = relaObj.x(name).chName(newName);
                                if (success) {
                                    parentThumb.setAttribute('data-name', newName);
                                    nameBtn.innerText = newName;
                                    name = newName;
                                } else {
                                    bv.notice(bv.getLang(`relationView > ${msg}`));
                                }
                            }
                        };
                    csvBtn.addEventListener('click', editCSV, false); // 绑定csv按钮点击事件
                    delBtn.addEventListener('click', delRela, false); // 绑定删除按钮点击事件
                    nameBtn.addEventListener('click', chName, false); // 绑定改名按钮点击事件
                    parentThumb.querySelector('#modifyBtn').onclick = rv.modify; // 绑定关系缩略图点击事件
                })(foot); // 采用闭包以防止可能的问题
            }
        });
    },
    float: function (html) {
        let tl = s('.relationLayer'), tc = s('.relationContent');
        tc.innerHTML = html;
        tl.style.display = 'block';
        applyStyle(tl, {
            'opacity': 1
        }, 50);
    },
    close: function () {
        let tl = s('.relationLayer'),
            tc = s('.relationContent');
        tl.style.opacity = 0;
        basicView.motionChecker(tl, () => {
            tl.style.display = 'none';
            tc.innerHTML = '';
        });
    },
    modify: async function (e) {
        let rv = relationView,
            bv = basicView,
            name = e.target.parentNode.getAttribute('data-name'), // 获得要编辑的关系名
            localTp = rv.modifyTemplate['main'],
            rsTp = Promise.resolve(localTp),
            mainHtml = await (localTp ? rsTp : fetch("./pages/relationModify.html")
                .then(resp => bv.fHook(resp).text()).catch((e) => {
                    bv.notice(bv.getLang('notice > relation.modifyPageLoadFailed'), true);
                    throw e;
                })
            ),
            tableTp;
        if (!localTp) { // 如果内存中还没有模板，就提取一下
            [tableTp, mainHtml] = mainHtml.extractTp('table', true);
            rv.modifyTemplate = {
                'main': mainHtml,
                'table': tableTp
            }
        }
        mainHtml = mainHtml.replaceTp('relationName', name); // 获得表格模板
        rv.float(bv.langRender('relationView', mainHtml)); // 渲染页面
        rv.modifyTableRender(name, s('.relationDetail')); // 渲染表格
    },
    modifyTableRender: function (name, printAt) { // 渲染编辑用的表格(关系名,打印到哪个元素里)
        let rv = this,
            bv = basicView,
            template = rv.modifyTemplate['table'], // 获得表格模板
            relation = relaObj.x(name).base, // 获得要编辑的关系表
            relaAttrs = relation['attrs'],
            relaTuples = relation['tuples'],
            relaSpan = relaAttrs.length, // 获得关系表的属性数量
            attrsTd = relaAttrs.map(x => `<td>${x}</td>`).join(''), // 构建属性列
            tuplesBody = ''; // 构建关系表内容
        for (let i = 0, len = relaTuples.length; i < len; i++) {
            let tuple = relaTuples[i],
                rowTd = tuple.map((x, j) => {
                    // 保留NULL和空值的区别
                    let content = (x == null) ? 'NULL' : x;
                    return `<td class='val'><a href='javascript:void(0);' id="cell-${j}-${i}" data-column="${j}">${content}</a></td>`
                }).join('');
            tuplesBody += `<tr data-row="${i}">${rowTd}<td class="controls val">
            <a href="javascript:void(0);" act="forward">↑</a>
        </td>
        <td class="controls val">
            <a href="javascript:void(0);" act="backward">↓</a>
        </td>
        <td class="controls val">
            <a href="javascript:void(0);" act="insert">+</a>
        </td>
        <td class="controls val">
            <a href="javascript:void(0);" act="del">×</a>
        </td></tr>`;
        }
        template = template.replaceTp('relationName', name)
            .replaceTp('relationSpan', relaSpan)
            .replaceTp('attrsRow', attrsTd) // 替换模板中的关系名和属性列
            .replaceTp('tuplesBody', tuplesBody); // 替换模板中的关系表内容
        printAt.innerHTML = bv.langRender('relationView', template); // 打印到页面
        let tableBtns = s('#relationBody').querySelectorAll('a'); // 获取所有a标签
        for (let btn of tableBtns) { // 绑定a标签点击事件
            let dataColumn = btn.getAttribute('data-column'); // 获得点击的a标签的data-column属性
            if (dataColumn) { // 存在data-column，说明是属性格，对值操作
                btn.onclick = rv.modifySingleVal;
            } else { // 不存在data-column，说明是编辑按钮，对元组操作
                btn.onclick = rv.modifyTuple;
            }
        }
    },
    modifyTuple: function (e) { // 操作元组(event)
        let rv = relationView,
            bv = basicView,
            elem = e.target,
            name = s('.relationDetail').getAttribute('data-name'), // 获得关系名
            action = elem.getAttribute('act'), // 获得操作内容
            rowElem = elem.parentNode.parentNode, // 获得当前行
            rowInd = Number(rowElem.getAttribute('data-row')), // 获得点击的元组行号
            tableElem = s('.relationDetail'),// 获得关系表展示元素
            result = '',
            relationObj = relaObj.x(name);
        switch (action) {
            case 'forward':
                result = relationObj.moveTuple(rowInd, rowInd - 1);
                break;
            case 'backward':
                result = relationObj.moveTuple(rowInd, rowInd + 1);
                break;
            case 'insert':
                result = relationObj.insertEmptyTuple(rowInd);
                break;
            case 'del':
                result = relationObj.delTuple(rowInd);
                break;
        }
        let [success, msg] = result;
        if (!success) { // 操作不成功
            bv.notice(bv.getLang(`relationView > ${msg}`));
            return false;
        }
        rv.modifyTableRender(name, tableElem); // 重渲染表格
    },
    modifySingleVal: function (e) { // 编辑一个值(event)
        let elem = e.target,
            name = s('.relationDetail').getAttribute('data-name'), // 获得关系名
            column = elem.getAttribute('data-column'), // 获得编辑的列号
            row = elem.parentNode.parentNode.getAttribute('data-row'), // 获得编辑的行号
            cell = s(`#cell-${column}-${row}`), // 获得编辑的单元格
            modifiedVal = s('#modifiedVal'), // 获得编辑框
            submitBtn = s('#modSubmit'), // 获得提交按钮
            rv = relationView,
            enterSubmit = (e) => {
                if (e.key == 'Enter') {
                    submitIt();
                }
            },
            submitIt = () => {
                let newVal = modifiedVal.value,
                    // NULL字符串转换成null
                    content = (newVal.toLowerCase() == 'null') ? null : newVal;
                relaObj.x(name).writeSingleVal(content, row, column);
                cell.innerHTML = newVal; // 更新单元格内容
                cancelModify();
            },
            cancelModify = () => {
                submitBtn.removeEventListener('click', submitIt);
                window.removeEventListener('keydown', enterSubmit);
                cell.style.backgroundColor = ''; // 设置单元格背景色，恢复默认
                modifiedVal.setAttribute('disabled', ''); // 禁用编辑框
                modifiedVal.value = ''; // 清空编辑框
                rv.modifyingCell = []; // 清空正在编辑的行列
            },
            cancelCheck = (e) => { // 检查是否取消编辑(event)
                let clickOn = e.target; // 获得点击的元素
                if (!['modifiedVal', 'modSubmit'].includes(clickOn.id)) { // 点击的不是表单
                    window.removeEventListener('mousedown', cancelCheck);
                    cancelModify(); // 取消编辑
                }
            };
        cell.style.backgroundColor = 'grey'; // 设置单元格背景色，突出重点
        rv.modifyingCell = [column, row]; // 记录正在编辑的行列
        modifiedVal.removeAttribute('disabled'); // 启用编辑框
        modifiedVal.focus(); // 聚焦编辑框
        modifiedVal.value = cell.innerText; // 填充编辑框
        submitBtn.addEventListener('click', submitIt); // 绑定提交按钮点击事件
        window.addEventListener('keydown', enterSubmit); // 绑定回车事件
        window.addEventListener('mousedown', cancelCheck); // 绑定失焦事件，能取消编辑
    },
    addRela: function () { // 添加关系表
        let bv = basicView,
            csvInput = s('#csvForm'),
            csvContent = csvInput.value,
            nameInput = s('#relationName'),
            name = nameInput.value.trim(), // 获得关系表名
            parsed = Relations.parseCsv(csvContent); // 解析CSV为数组
        if (name.notEmpty()) {
            relaObj.x(name).write(parsed).then(resArr => {
                /* 这里resolve的是一个数组:[是否是在编辑已有关系,成功消息] */
                csvInput.value = '';
                nameInput.value = ''; // 提交后清空表单
                if (!resArr[0]) bv.prevCSVInput = ''; // 提交后清空之前的CSV输入(当是新建而不是编辑时)
                bv.notice(bv.getLang('notice > ' + resArr[1]));
                bv.nameInputChecker(); // 检查应用按钮文字
            }, rej => {
                bv.notice(bv.getLang('notice > ' + rej));
            });
        } else {
            bv.notice(bv.getLang('notice > relation.nameRequired'));
        }
    }
};

const playView = { // 演示视图
    show: function () {
        let layer = s('.playLayer');
        layer.style.display = 'block';
        setTimeout(() => {
            layer.style.opacity = '1';
        }, 10);
    },
    close: function () {
        let layer = s('.playLayer'),
            bv = basicView;
        layer.style.opacity = '0';
        bv.motionChecker(layer, () => {
            layer.style.display = 'none';
        });
    }
};


// Testing code below! 下方为测试代码

/*
setTimeout(() => {
    s('.algebraInput').value = `PROJECT{NAME}(EXCEPT)
EXCEPT
PROJECT{NAME}(
    (SELECT{NAME='高二'}((STUDENT))) 
    JOIN
    (SC)
    JOIN
    (TEST)
)
UNION
STUDENT`;
}, 500);
*/
setTimeout(() => {
    s('.algebraInput').value = `TEST1 DIVIDEDBY TEST2`;
}, 500);
/*
playView.show();

window.onload = () => {
    let playObj = Plays.x(s('.playLayer > #tables')),
        table1 = new Relations().x('STUDENT').base,
        table2 = new Relations().x('SC').base,
        [canvasWd, canvasHt] = playObj.measureTable([table1, table2], 20, 10);
    playObj.setSize(canvasWd, canvasHt);
    let [tableWd, tableHt, cellsInfo] = playObj.drawTable(table1, 20, 10);
    playObj.drawTable(table2, 20, 10, tableWd);
    let cells2mask = cellsInfo.flat().slice(3, 8);
    playObj.eraseCells(cells2mask);
    let playObj2 = Plays.x(s('.playLayer > #tuples'));
    playObj2.setSize(canvasWd, canvasHt * 2);
    let cells1 = new cellsGroup(cells2mask),
        [endx, endy] = cells2mask[0];
    //console.log(endx, endy);
    let listIndex = Plays.addCellsAni(cells1, ['movement', 100, 'easeInOut', [endx, endy], [endx + 20, endy + 200]]);
    Plays.addCellsAni(cells1, ['opacity', 200, 'easeInOut', 1, 0.5], listIndex);
    Plays.addCellsAni(cells1, ['emphasis', 150, 'easeInOut', [255, 46, 46, 0], [255, 46, 46, 0.2]], listIndex);
    Plays.tickList = Plays.playList[0]
    cells1.draw();
    window.cells1 = cells1;
    window.addEventListener('ticklistend', () => {
        console.log('AnimationTickingEnd');
    });
    Plays.tickAnim();
}
*/