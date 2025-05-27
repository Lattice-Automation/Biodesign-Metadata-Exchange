import lombok.Data;

import java.util.Map;

@Data
public class BioDesignOperation {
    private String operationCode;
    private Map<String, Object> operationDetails;
    private String change;
    private String timestamp;
    private String tool;
}
