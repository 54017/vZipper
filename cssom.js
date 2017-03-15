 module.exports = (function() {

    let http     = require('http'),
        cheerio  = require('cheerio'),
        priority = require('css-priority');

    function parseSelectorToToken(subselector) {
      let tokens = []; 
      subselector.split(/(?=\.)|(?=#)|(?=\[)/).forEach(function(token){
        switch (token[0]) {
          case '#':
             tokens.push(token.slice(1));
            break;
          case '.':
             tokens.push(token.slice(1));
            break;
          case '[':
             tokens.push(token.slice(1,-1).split('=')[1]);
            break;
          default :
             tokens.push(token);
            break;
        }
      });
      return [...new Set(tokens)];
    }

    let parseCss = function(css) {
		let reg = /}?\s?([^{};]*)\s*{([^{}]*)}/g,
		    map = new Map(),
		    arr;
		while (arr = reg.exec(css)) {
            // 去掉url()内的字符先，例如 url("images;/test.jpg")
            let urlReg    = /url\s*\((.*\s*)\)/g;
            let urlMap = new Map();
            arr[2] = arr[2].replace(urlReg, function(str) {
                let random = Math.random();
                urlMap.set(random, str);
                return '$' + random + '$';
            })
			let properties = arr[2].split(';'),
			    rules      = [];
			for (let i = 0, len = properties.length; i < len; ++i) {
                if (properties[i] == '') continue;
                properties[i] = properties[i].replace(/\$(\d\.\d+)\$/, function(str, number) {
                    number = +number;
                    let originalStr = urlMap.get(number);
                    if (originalStr) {
                        return originalStr;
                    } else {
                        return number;
                    }
                })
                let ruleKeyValueReg = /(.+?)\s*:\s*(.*)/g;
				let ruleKeyValue = ruleKeyValueReg.exec(properties[i]),
                    property     = [];
                property[1] = ruleKeyValue[2].trim();
                property[0] = ruleKeyValue[1].trim();
				rules.push(property);
			}
            let existed  = map.get(arr[1].trim()),
                diffFlag = true;
            if (existed) {
                // 去除 body { margin: 2px } body { margin: 3px } 的情况，后者代替前者
                for (let i = 0, rulesLen = rules.length; i < rulesLen; ++i) {
                    diffFlag = true;
                    for (let j = 0, len = existed.length; j < len; ++j) {
                        // 同一个 css rule
                        if (existed[j][0] === rules[i][0]) {
                            diffFlag = false;
                            if (existed[j][1].indexOf('!important') > 0 && rules[i][1].indexOf('!important') < 0) {

                            } else {
                                existed[j][1] = rules[i][1];
                            }
                            break;
                        }
                    }
                    if (diffFlag) existed.push(rules[i]);
                }
                map.set(arr[1].trim(), existed);
            } else {
			 map.set(arr[1].trim(), rules);
            }
		}
		// 'div': [['margin', '0px !important']]
		return map;
    }

    let getHtmlToken = function(html) {
    	let tokens = [],
    	    reg    = /['"]([^'"]*)['"]/g,
            tagReg = /<(\w+)\s*.*?>/g,
    	    arr;
    	while(arr = reg.exec(html)) {
    		tokens = tokens.concat(arr[1].split(' '));
    	}
        while(arr = tagReg.exec(html)) {
            tokens.push(arr[1]);
        }
    	return [...new Set(tokens)];
    }

    let getJsToken = function(js) {
    	let tokens = [],
    	    reg    = /['"]([^'"]*)['"]/g,
    	    arr;
    	while(arr = reg.exec(js)) {
    		tokens = tokens.concat(arr[1].split(' '));
    	}
    	return [...new Set(tokens)];
    }

    let zipCss = function(html, css, js) {
        let $           = cheerio.load(html),
            map         = parseCss(css),
            existTokens = getHtmlToken(html).concat(getJsToken(js)),
            selector;
        // 去掉所有未出现在html和js中的选择器
        for (selector of map.keys()) {
            let cssTokens = parseSelectorToToken(selector);
        	for (let i = 0, len = cssTokens.length; i < len; ++i) {
        		if (existTokens.indexOf(cssTokens[i]) >= 0) {
        			break;
        		}
        		if (i == len - 1) {
        			map.delete(selector); // css 选择器未出现在 html 与 js 中，所以去掉
        		}
        	}
        }
        // 去掉被优先级干掉的 css rule
        for (selector of map.keys()) {
            if (selector.indexOf(':') >= 0) continue;
            let $selector = $(selector);
        	$selector.each((i, elem) => {
        		let $this    = $($selector[i]),
        		    dataRule = $this.data('rule') || '{}',
                    rules    = map.get(selector);
        		dataRule = JSON.parse(dataRule);
    			for (let i = 0, len = rules.length; i < len; ++i) {
    				let rule = rules[i];
					if (rule[1].indexOf('!important') >= 0) {
						dataRule[rule[0]] = selector;
					} else if (!dataRule[rule[0]] || (dataRule[rule[0]] && priority.compare(priority.parse(dataRule[rule[0]]), priority.parse(selector)) == -1)) {
                        
                        dataRule[rule[0]] = selector;
					} else {
                    }

    			}
                $this.data('rule', JSON.stringify(dataRule));
        	})
        }
        for (let selector of map.keys()) {
            if (selector.indexOf(':') >= 0) continue;
            let rules          = map.get(selector),
                matchedHtml    = $(selector),
                matchedHtmlLen = matchedHtml.length;
            for (let i = 0, len = rules.length; i < len; ++i) {
                let rule = rules[i];
                matchedHtml.each((index, elem) => {
                    let $this    = $(matchedHtml[index]),
                        dataRule = $this.data('rule') || '{}';
                    dataRule = JSON.parse(dataRule);
                    if (dataRule[rule[0]] === selector) {
                        return false;
                    } else if (index === matchedHtmlLen - 1) {
                        delete rules[i]
                    }
                });
            }
            map.set(selector, rules);
        }
        console.log(map);
    }

    return zipCss;

}());


    