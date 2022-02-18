const INDEX64 = (
  "乾为天 坤为地 水雷屯 山水蒙 水天需 天水讼 地水师 水地比 " +
  "风天小畜 天泽履 地天泰 天地否 天火同人 火天大有 地山谦 雷地豫 " +
  "泽雷随 山风蛊 地泽临 风地观 火雷噬嗑 山火贲 山地剥 地雷复 " +
  "天雷无妄 山天大畜 山雷颐 泽风大过 坎为水 离为火 泽山咸 雷风恒 " +
  "天山遁 雷天大壮 火地晋 地火明夷 风火家人 火泽睽 水山蹇 雷水解 " +
  "山泽损 风雷益 泽天夬 天风姤 泽地萃 地风升 泽水困 水风井 " +
  "泽火革 火风鼎 震为雷 艮为山 风山渐 雷泽归妹 雷火丰 火山旅 " +
  "巽为风 兑为泽 风水涣 水泽节 风泽中孚 雷山小过 水火既济 火水未济"
).split(" ");

const INDEX8 = Array.from("乾兑离震巽坎艮坤").map((e) =>
  INDEX64.find((i) => i.startsWith(e)).split("为")
);

const NUM = { [true]: "九", [false]: "六" };
const NUM_OTHER = "01二三四五六";

const index_text = (n, yang) => {
  const num = NUM[yang];
  return n === 1 ? `初${num}` : `${num}${NUM_OTHER[n]}`;
};

// locate8(1, 1, 1) => ["乾", "天"]
const locate8 = (a, b, c) => INDEX8[(!a << 2) + (!b << 1) + !c];

// locate64('天', '地') => "天地否"
const locate64 = (up, down) =>
  up === down
    ? INDEX8.find((e) => e[1] === up).join("为")
    : INDEX64.find((e) => e.startsWith(up + down));

// rand(48) => 9
const rand =
  typeof crypto < "u" && crypto.getRandomValues
    ? (max) => {
        const buf = new Uint8Array(1);
        crypto.getRandomValues(buf);
        return buf[0] % max;
      }
    : (max) => Math.floor(Math.random() * max);

const count = (arr, fn) => arr.reduce((s, a) => s + Number(fn(a)), 0);

// make one '- -' or '---' (爻)
const yao = () => {
  // 大衍之数五十，
  let all = 50;
  // 其用四十有九。
  all -= 1; // now [ all = 49 ]
  for (let i = 0; i < 3; ++i) {
    // 分而为二以象两，
    let left = rand(all + (i ? 1 : 0));
    let right = all - left;
    // 挂一以象三，
    right -= 1; // now [ left + right = 48 ]
    // 揲之以四，以象四时，归奇于扐以象闰。
    let rem_l = left % 4 || 4;
    let rem_r = right % 4 || 4; // now [ rem_l + rem_r = 4 or 8 ]
    all = left + right - rem_l - rem_r; // now [ all = 48 - 4|8 = 44|40 ]
  }
  return all / 4; // 6 | 7 | 8 | 9
};

const gua = (arr) => {
  const up = locate8(...arr.slice(0, 3).reverse());
  const down = locate8(...arr.slice(3).reverse());
  return locate64(up[1], down[1]);
};

const $$yao = Array.from(document.querySelectorAll(".yao"));
const $figure = $$yao[0].parentElement;
const $$yao2 = $$yao.splice(6, 6);
const $figure2 = $$yao2[0].parentElement;
const $display = document.querySelector(".display");
const $info = document.querySelector(".info");
const $message = document.querySelector(".message");

const render_yao = (index, yao) => {
  const $yao = $$yao[6 - index];
  const yang = yao % 2 === 1;
  const bian = yao === 6 || yao === 9;
  $yao.classList.toggle("yin", !yang);
  $yao.classList.toggle("yang", yang);
  $yao.classList.toggle("bian", bian);
  if (index === 6) {
    $message.textContent = "结果";
  } else {
    $message.textContent = `再点 ${6 - index} 下`;
  }
};

const fix_bian_and_finish_suan_gua = () => {
  let bian_shu = count($$yao, (a) => a.classList.contains("bian"));
  const is_qian = $$yao.every((a) => a.classList.contains("yang"));
  const is_kun = $$yao.every((a) => a.classList.contains("yin"));
  const yong = (is_qian && bian_shu === 6) || (is_kun && bian_shu === 6);
  if (bian_shu > 3 && !yong) {
    $$yao.forEach(($yao) => $yao.classList.toggle("bian"));
    bian_shu = 6 - bian_shu;
  }
  $$yao2.forEach(($yao2, i) => {
    $yao2.className = $$yao[i].className;
  });
  if (bian_shu > 0 && !yong) {
    $$yao2.forEach(($yao2, i) => {
      if ($$yao[i].classList.contains("bian")) {
        $yao2.classList.toggle("yin");
        $yao2.classList.toggle("yang");
      }
    });
    $figure2.style.display = "";
  }
  const before = gua(
    $$yao.map(($yao) => Number($yao.classList.contains("yang")))
  );
  const after = gua(
    $$yao2.map(($yao) => Number($yao.classList.contains("yang")))
  );
  let text = bian_shu ? before + " 变 " + after : before + " 无变卦";
  if (bian_shu) {
    if (yong) {
      text += `\n变卦：用${is_qian ? "九" : "六"}`;
    } else {
      const bian_gua = $$yao.flatMap(($yao, i) =>
        $yao.classList.contains("bian")
          ? [[6 - i, $yao.classList.contains("yang")]]
          : []
      );
      text += `\n变卦：${bian_gua
        .reverse()
        .map((e) => index_text(...e))
        .join("、")}`;
    }
  }
  $info.textContent = text;
  const share = $$yao.map(($yao) => {
    const bian = $yao.classList.contains("bian");
    const yang = $yao.classList.contains("yang");
    return bian ? (yang ? 9 : 6) : yang ? 7 : 8;
  });
  history.replaceState({}, "", location.pathname + "?gua=" + share);
};

const clear = () => {
  $figure2.style.display = "none";
  $info.textContent = "";
  $$yao.forEach(($yao) => $yao.classList.remove("yin", "yang", "bian"));
  $message.textContent = "点击图案开始算卦";
};

function* suan_gua() {
  for (let i = 1; i < 6; ++i) {
    yield [i, yao()];
  }
  return [6, yao()];
}

function main() {
  const match = location.search.match(/gua=(\d),(\d),(\d),(\d),(\d),(\d)/);
  if (match) {
    const share = match.slice(1, 7).map((e) => parseInt(e));
    if (share.every((e) => 6 <= e && e <= 9)) {
      for (let i = 1; i <= 6; ++i) {
        render_yao(i, share[6 - i]);
      }
      fix_bian_and_finish_suan_gua();
    } else {
      console.warn("invalid share data, expecting [6,7,8,9] x 6");
    }
  }
  let suan;
  const on_click = () => {
    if (!suan) {
      clear();
      suan = suan_gua();
      render_yao(...suan.next().value);
    } else {
      const ret = suan.next();
      render_yao(...ret.value);
      if (ret.done) {
        fix_bian_and_finish_suan_gua();
        suan = null;
      }
    }
  };
  $display.addEventListener("click", on_click);
  $message.addEventListener("click", on_click);
}

main();
