import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BioDesignMetadata {
    private String id;
    private String parentMetadataId;
    private String designName;
    private String designChecksum;
    private String author;
    private String description;
    private String lastUpdated;
    private List<BioDesignOperation> changelog = new ArrayList<>();
}
