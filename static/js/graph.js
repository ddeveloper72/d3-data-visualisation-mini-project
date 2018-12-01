queue()
    .defer(d3.json, "data/Salaries.json")
    .await(makeGraphs);

//*************************************************************************************************
// Cross filter Function   
function makeGraphs(error, salaryData){
    var ndx = crossfilter(salaryData);
    
    salaryData.forEach(function(d){
        d.salary = parseInt(d.salary);
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]); // "yrs.since.phd" needs to be converted into an integer. 
        d.yrs_service = parseInt(d["yrs.service"]); // "yrs.service" needs to be converted into an integer. 
    })
    
    show_discipline_selector(ndx);
    show_percent_that_are_professors(ndx, "Female", "#percent-of-women-professors");   // 1 function and the 
    show_percent_that_are_professors(ndx, "Male", "#percent-of-men-professors");       // div ID is here too
    show_gender_balance(ndx);
    show_average_salaries(ndx);
    show_rank_distribution(ndx);
    
    show_service_to_salary_correlation(ndx)
    show_phd_to_salary_correlation(ndx)
    
    dc.renderAll();
}


function show_discipline_selector(ndx) {
    dim = ndx.dimension(dc.pluck('discipline'));
    group = dim.group()
    
    dc.selectMenu("#discipline-selector")
        .dimension(dim)
        .group(group);
}

//*************************************************************************************************
// Percent Profesors Function
function show_percent_that_are_professors(ndx, gender, element){
    var percentageThatAreProf = ndx.groupAll().reduce(
        function (p,v){
            if (v.sex === gender){
                p.count++;
                if (v.rank === "Prof"){
                    p.are_prof++;
                }
            }
            return p;
        },
        function (p,v){
            if (v.sex === gender){
                p.count--;
                if (v.rank === "Prof"){
                    p.are_prof--;
                }
            }
            return p;
        },
        function (){
            return {count: 0, are_prof: 0};
        }
    );

// A Text Number Display Graphic
dc.numberDisplay(element)
    .formatNumber(d3.format(".2%")) // percentage number format to 2 decimal places
    .valueAccessor(function(d){
        if (d.count == 0){
            return 0;
        } else {
            return (d.are_prof / d.count);
        }
    })
    .group(percentageThatAreProf);
}    


//*************************************************************************************************
// Gender Balance Function
function show_gender_balance(ndx){
    var dim = ndx.dimension(dc.pluck('sex'));
    var group = dim.group();

//Gender Balance Chart
    dc.barChart("#gender-balance")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxisLabel("Number of Professors")
        .yAxis().ticks(20);
}

//*************************************************************************************************
// Average Salary Function
function show_average_salaries(ndx){
    var dim = ndx.dimension(dc.pluck('sex'));
    
    function add_item(p, v){
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }
    
    function remove_item(p, v){
        p.count--;
        if(p.count == 0){
            p.total = 0;
            p.average = 0;
        } else {
            p.total -= v.salary;
         p.average = p.total / p.count;
        }
        return p;
    }
    
    function initilise(){
        return {count: 0, total: 0, average: 0};
    }
    
    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initilise);

    
// Average Salary Chart    
    dc.barChart("#average-salary")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function(d){
            return d.value.average.toFixed(2);
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .elasticY(true)
        .xAxisLabel("Gender")
        .yAxisLabel("Average Salary")
        .yAxis().ticks(4);
}

//*************************************************************************************************
// Rank Distribution Function  Getting the rank vs sex data
function show_rank_distribution(ndx){
   
    function rankByGender (dimension, rank){
        return dimension.group().reduce(
        function (p, v){
            p.total++;
            if(v.rank == rank){
                p.match++;
            }
            return p;
        },
        
        function (p, v){
            p.total--;
            if(v.rank == rank){
                p.match--;
            }
            return p;
        },
        
        function (){
            return {total: 0, match: 0};
        } 
        
        );
    }
    
    var dim = ndx.dimension(dc.pluck('sex'));                   // The sex of each rank label
    var profByGender = rankByGender(dim, "Prof");               // Rank lables from source data
    var asstProfByGender = rankByGender(dim, "AsstProf");       //
    var assocProfByGender = rankByGender(dim, "AssocProf");     //
    
    console.log(asstProfByGender.all());
   
   
   // Rank Distribution Chart     
   dc.barChart("#rank-distribution")
        .width(350)
        .height(250)
        .dimension(dim)
        .group(profByGender, "Prof") // chart label
        .stack(asstProfByGender, "Asst Prof") // chart label
        .stack(assocProfByGender, "Assoc Prof") // chart label
        .valueAccessor(function (d){
            if(d.value.total > 0){
                return (d.value.match / d.value.total) * 100;
                } else {
                    return 0;
                }
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .legend(dc.legend().x(320).y(20).itemHeight(15).gap(5))
        .margins({top: 10, right: 100, bottom: 30, left: 30})
        .yAxisLabel("Proportion of Rank Distribution")
        .xAxisLabel("Gender");
}

//*************************************************************************************************
// Years Service to Salary Correlation Function

function show_service_to_salary_correlation(ndx){
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"])
    
    var eDim = ndx.dimension(dc.pluck("yrs_service"));
    var experienceDim = ndx.dimension(function(d){
        return [d.yrs_service, d.salary, d.rank, d.sex]; // my dimension keys [0 to 3]
    });
    var experienceSalaryGroup = experienceDim.group();
    
    var minExperience = eDim.bottom(1)[0].yrs_service;
    var maxExperience = eDim.top(1)[0].yrs_service;

// Years Service to Salary Correlation    
    dc.scatterPlot("#service-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minExperience,maxExperience]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .xAxisLabel("Years of Service")
        .yAxisLabel("Salary Earned")
        .title(function(d){
            return d.key[2] + "Earned " + d.key[1];
        })
        .colorAccessor(function(d){
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
}  

//*************************************************************************************************
// PHD to Salary Correlation Function

function show_phd_to_salary_correlation(ndx){
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"])
    
    var pDim = ndx.dimension(dc.pluck("yrs_since_phd"));
    var phdDim = ndx.dimension(function(d){
        return [d.yrs_since_phd, d.salary, d.rank, d.sex]; // my dimension keys [0 to 3]
    });
    var phdSalaryGroup = phdDim.group();
    
    var minPhd = pDim.bottom(1)[0].yrs_since_phd;
    var maxPhd = pDim.top(1)[0].yrs_since_phd;

// Years Service to Salary Correlation    
    dc.scatterPlot("#phd-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhd,maxPhd]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .xAxisLabel("Years Since PHD")
        .yAxisLabel("Salary Earned")
        .title(function(d){
            return d.key[2] + "Earned " + d.key[1]
        })
        .colorAccessor(function(d){
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75})
}