"""Data models: per-direction parameters, emulation config, profile."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Distribution = Literal["none", "normal", "pareto", "paretonormal"]
LossMode = Literal["none", "random", "burst"]


class DirectionParams(BaseModel):
    """netem parameters for one traffic direction."""

    # Delay
    delay_ms: float = Field(0, ge=0, le=60000)
    jitter_ms: float = Field(0, ge=0, le=60000)
    jitter_correlation_pct: float = Field(0, ge=0, le=100)
    distribution: Distribution = "none"
    keep_order: bool = False  # jitter without reordering

    # Packet loss
    loss_mode: LossMode = "none"
    loss_pct: float = Field(0, ge=0, le=100)
    loss_correlation_pct: float = Field(0, ge=0, le=100)  # "random" mode only
    loss_burst_len: float = Field(5, ge=1, le=10000)  # "burst" mode: mean burst length

    # Bandwidth and queue
    rate_kbit: float = Field(0, ge=0, le=100_000_000)  # 0 = unlimited
    limit: int = Field(10000, ge=1, le=1_000_000)  # netem queue length [packets]

    # Other impairments
    reorder_pct: float = Field(0, ge=0, le=100)
    reorder_correlation_pct: float = Field(0, ge=0, le=100)
    duplicate_pct: float = Field(0, ge=0, le=100)
    corrupt_pct: float = Field(0, ge=0, le=100)

    # MTU of the egress interface (None = default)
    mtu: Optional[int] = Field(None, ge=68, le=9000)

    @model_validator(mode="after")
    def _check(self):
        if self.reorder_pct > 0 and self.delay_ms <= 0:
            raise ValueError("Reordering requires a delay greater than 0 ms")
        if self.loss_mode == "burst" and self.loss_pct >= 100:
            raise ValueError("Burst loss must be below 100 % (for a complete outage use random loss of 100 %)")
        if self.keep_order and self.reorder_pct > 0:
            raise ValueError("Keeping packet order and reordering cannot be enabled together")
        return self


class EmulationConfig(BaseModel):
    a_to_b: DirectionParams = Field(default_factory=DirectionParams)
    b_to_a: DirectionParams = Field(default_factory=DirectionParams)


class Profile(EmulationConfig):
    name: str = Field(..., min_length=1, max_length=64)
    description: str = Field("", max_length=500)
    # Display translations, e.g. {"pl": {"name": "...", "description": "..."}}.
    # "name" stays the profile key in the API and on disk.
    translations: dict[str, dict[str, str]] = Field(default_factory=dict)


class StartRequest(BaseModel):
    config: EmulationConfig
    profile: Optional[str] = None  # profile the config came from (informational)
    modified: bool = False  # config differs from the saved profile
