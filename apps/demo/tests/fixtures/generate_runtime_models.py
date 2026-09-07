"""生成浏览器回归使用的微型 ONNX 模型，不依赖远程模型下载。"""

import base64
import hashlib
import json
from pathlib import Path

import onnx
from onnx import TensorProto, helper


def model_bytes(role, shape, values):
    tensor = helper.make_tensor("constant", TensorProto.FLOAT, shape, values)
    graph = helper.make_graph(
        [helper.make_node("Constant", [], ["output"], value=tensor)],
        role,
        [helper.make_tensor_value_info("x", TensorProto.FLOAT, [1, 3, "H", "W"])],
        [helper.make_tensor_value_info("output", TensorProto.FLOAT, shape)],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 14)], ir_version=8)
    onnx.checker.check_model(model)
    data = model.SerializeToString()
    return {"base64": base64.b64encode(data).decode("ascii"), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "shape": shape}


models = {
    "det": model_bytes("det", [1, 1, 8, 8], [0.99 if 2 <= x < 6 and 2 <= y < 6 else 0 for y in range(8) for x in range(8)]),
    "rec": model_bytes("rec", [1, 3, 2], [0.01, 0.99] * 3),
}
Path(__file__).with_name("runtime-models.json").write_text(json.dumps(models, indent=2) + "\n", encoding="utf-8")
