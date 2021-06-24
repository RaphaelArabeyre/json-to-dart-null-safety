/*
 * @Descripttion: 生成dart类型
 * @Author: KuuBee
 * @Date: 2021-06-23 14:31:51
 * @LastEditors: KuuBee
 * @LastEditTime: 2021-06-24 17:17:34
 */
import { ArrayNode, ValueNode, LiteralNode, ObjectNode } from "json-to-ast";
import { Utils } from "./utils";

// AST node 类型
type AstType = "Object" | "Array" | "Literal";

// dart 基础类型
type DartBaseType =
  | "String"
  | "bool"
  | "int"
  | "double"
  | "dynamic"
  | "num"
  | "Null";

interface GenerateDartTypeOptions {
  val?: ValueNode;
  valList?: ValueNode[];
  key: string;
  arrayMod?: boolean;
}

export class GenerateDartType {
  constructor({
    val,
    valList,
    key,
    // TODO
    arrayMod = false
  }: GenerateDartTypeOptions) {
    if (arrayMod)
      if (!valList || val) throw "arrayMod下valList必须有值并且val为空";
    if (!arrayMod) if (!val || valList) throw "val必须有值并且valList为空";
    this.val = val;
    this.key = key;
    if (!arrayMod) this.dartType = this._getType(val!);
    else {
      const dartTypeList = [];
      for (const item of valList!) {
        dartTypeList.push(this._getType(item));
      }
      const typeListRes = Array.from(new Set(dartTypeList));
      if (typeListRes.length > 1 && typeListRes.includes("null")) {
        this.dartType =
          (typeListRes[0] === "null" ? typeListRes[1] : typeListRes[0]) + "?";
        const astTypeList = valList!.map((item) => item.type);
        if (astTypeList.length > 1) {
          this.astType = astTypeList[0];
        } else {
          if (!astTypeList.includes("Literal")) this.astType = astTypeList[0];
          else this.astType = "Literal";
        }
      } else if (
        typeListRes.includes("double") &&
        typeListRes.includes("int")
      ) {
        this.astType = valList![0].type;
        this.dartType = `num${typeListRes.includes("null") ? "?" : ""}`;
      } else {
        this.astType = valList![0].type;
        this.dartType = typeListRes[0];
      }
    }
    // this.astType = val?.type as AstType;
  }
  val?: ValueNode;
  key: string;

  // 最终的类型
  dartType: string;
  // 是否可能为null
  // int? TestClass? List<int>? List<int?>?
  // 不包含 List<int?>
  nullable: boolean = false;
  // 是否为 对象数组
  // [{"a":1},{"a":2}]
  isArrayObject: boolean = false;

  astType?: AstType;

  // 获取类型
  private _getType(val: ValueNode): string {
    let res: string;
    switch (val.type) {
      case "Literal":
        res = this._getDartBaseType((val as LiteralNode).value);
        this.nullable = res === "Null";
        break;
      case "Object":
        res = Utils._toCamelCase(Utils._toUnderline(this.key), "defalut");
        break;
      case "Array":
        res = this._getDartArrayType(val as ArrayNode, val.type);
        break;
      default:
        res = "dynamic";
    }
    return res;
  }
  // 获取基础类型
  private _getDartBaseType(data: any): DartBaseType {
    // 默认为 dynamic 类型 兜底
    let resType: DartBaseType = "dynamic";
    const dataType = typeof data;
    switch (dataType) {
      case "number": {
        if (Number.isInteger(data)) resType = "int";
        else resType = "double";
        break;
      }
      case "string":
        resType = "String";
        break;
      case "boolean":
        resType = "bool";
        break;
      case "object":
        resType = "Null";
        break;
      default:
        break;
    }
    return resType;
  }
  // 获取数组类型
  private _getDartArrayType(data: ArrayNode, valType: AstType) {
    const children = data.children;
    let typeList: AstType[] = [];
    let valList: any[] = [];
    for (const item of children) {
      typeList.push(item.type);
      switch (item.type) {
        case "Literal":
          valList.push((item as LiteralNode).value);
          break;
        default:
          valList.push((item as ArrayNode | ObjectNode).children);
      }
    }
    // debugger;
    // 不包含null的数组数据
    let notNullValList: any[];
    // 最终结果
    let resType: string;
    // 当前数组是否包含null
    const hasNull: boolean = valList.includes(null);
    // 当去重后长度为1时 表示不为 nullable
    if (Array.from(new Set(typeList)).length === 1 && !hasNull) {
      notNullValList = typeList;
    } else {
      notNullValList = typeList.filter((item) => item != null);
    }
    const singleNodeType = notNullValList[0];
    // 当为 基础数据数组 [1,2,3,4]
    if (singleNodeType === "Literal") {
      const singleType = this._getDartBaseType(valList[0]);
      // 这里有个特殊情况 如果数组为 [1,2,3.2,4.6] 这种情况
      // 类型应扩展为 num
      if (singleType === "int" || singleType === "double") {
        if (
          Array.from(
            new Set(valList.map((item) => this._getDartBaseType(item)))
          ).length === 1
        )
          resType = singleType;
        else resType = "num";
      } else resType = this._getDartBaseType(valList[0]);
    }
    // 当为 对象数组 [{a:1,b:2},{a:2,b:4}]
    else if (singleNodeType === "Object") {
      this.isArrayObject = true;
      resType = Utils._toCamelCase(Utils._toUnderline(this.key), "defalut");
    } else if (valList.length === 0) {
      // 空数组
      // 这里的策略是 空数组 类型为 dynamic
      resType = "dynamic";
    }
    // 当为 [[1,2,3],[4,5,6]]
    else throw "不支持多维数组";
    return `List<${resType}${hasNull && resType != "dynamic" ? "?" : ""}>`;
  }
}
