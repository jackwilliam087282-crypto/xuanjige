
# Local deterministic engines. No network or AI calls.
import sys, json, datetime, contextlib, io
sys.stdout.reconfigure(encoding="utf-8")
def run(q):
    kind=q.get("kind")
    y,m,d,h,mi=[int(q.get(k,0)) for k in ["year","month","day","hour","minute"]]
    datetime.datetime(y,m,d,h,mi)
    if not 1900<=y<=2100: raise ValueError("Year must be 1900..2100")
    if kind=="taiyi":
        from kintaiyi.kintaiyi import Taiyi
        calc=Taiyi(y,m,d,h,mi); style=int(q.get("style",3)); method=int(q.get("method",0))
        if style not in range(5) or method not in range(4): raise ValueError("Invalid Taiyi convention")
        # Expose the actual configured arithmetic and board, without automated event predictions.
        from kintaiyi import config
        return {"体系":"太乙神数","计算实现":"kintaiyi 0.2.3 / MIT",
          "计式":config.taiyi_name(style),"积年法":config.ty_method(method),
          "积数":calc.accnum(style,method),"局式":calc.kook(style,method),
          "太乙落宫":calc.ty(style,method),"太乙":calc.ty_gong(style,method),
          "文昌":calc.skyeyes(style,method),"始击":calc.sf(style,method),
          "主算":calc.home_cal(style,method),"客算":calc.away_cal(style,method),
          "主将":calc.home_general(style,method),"客将":calc.away_general(style,method),
          "主参":calc.home_vgen(style,method),"客参":calc.away_vgen(style,method),
          "八门":calc.geteightdoors(style,method),"太岁":calc.taishui(style),
          "合神":calc.hegod(style),"计神":calc.jigod(style),
          "说明":"以选择的计式和积年法独立计算。主客是传统局式角色；未指定事件时不转写成现实胜负或应期。"}
    if kind=="liuren":
        from kinliuren.kinliuren import Liuren
        from kintaiyi import jieqi,config
        gz=config.gangzhi(y,m,d,h,mi)
        lm=config.lunar_date_d(y,m,d)["月"]
        month=["正","二","三","四","五","六","七","八","九","十","十一","十二"][abs(lm)-1]
        n=int(q.get("method",0))
        if n not in (0,1): raise ValueError("Invalid nobleman convention")
        return {"体系":"大六壬","计算实现":"kinliuren / MIT","贵人法":n,
          **Liuren(jieqi.jq(y,m,d,h,mi),month,gz[2],gz[3]).result(n)}
    if kind=="qimen":
        from kinqimen.kinqimen import Qimen
        n=int(q.get("method",1))
        if n not in (1,2): raise ValueError("Invalid Qimen convention")
        return {"体系":"时家奇门","计算实现":"kinqimen / MIT","定局法":"拆补" if n==1 else "置闰",**Qimen(y,m,d,h,mi).pan(n)}
    raise ValueError("Unsupported engine")
try:
    q=json.loads(sys.stdin.read())
    # Upstream incidental diagnostics must not contaminate the IPC protocol.
    with contextlib.redirect_stdout(io.StringIO()):
        result=run(q)
    print(json.dumps({"ok":True,"result":result},ensure_ascii=False,default=str))
except Exception as e:
    print(json.dumps({"ok":False,"error":str(e)},ensure_ascii=False))
    sys.exit(1)
