from typing import List, Dict, Any, Literal, Optional
from pydantic import BaseModel, Field

class FhirCoding(BaseModel):
    system: str
    code: str
    display: str

class FhirCodeableConcept(BaseModel):
    coding: List[FhirCoding]
    text: Optional[str] = None

class FhirReference(BaseModel):
    reference: str
    display: Optional[str] = None

class FhirIdentifier(BaseModel):
    use: Optional[str] = "official"
    system: str
    value: str

class FhirResourceEntry(BaseModel):
    fullUrl: str
    resource: Dict[str, Any]

class FhirBundle(BaseModel):
    resourceType: Literal["Bundle"] = "Bundle"
    id: str
    type: Literal["collection", "transaction"] = "collection"
    timestamp: str
    meta: Optional[Dict[str, Any]] = None
    identifier: Optional[FhirIdentifier] = None
    entry: List[FhirResourceEntry] = Field(default_factory=list)
